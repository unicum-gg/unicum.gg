import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { DateShape } from "@/lib/date-shapes";
import { LocalDate } from "@/components/local-date";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import { PlayerBoard } from "@/components/players/list/boards";
import { PlayerLanguageSelect } from "@/components/players/list/language-select";
import { PlayerStrictModeToggle } from "@/components/players/list/strict-mode-toggle";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import {
  MarksBoard,
  type MarksRow,
} from "@/components/players/list/marks/board";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import Image from "next/image";
import { buildSafe, unicum } from "@/services/sdk";
import { getTranslation } from "@/lib/translations.server";
import { languageDisplayName } from "@/lib/language-name";
import { languageToCountryCode } from "@unicum.gg/shared";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;

const EMPTY = {
  results: [],
  tiers: [],
  languages: [],
  coverage: {
    ranked: 0,
    measured: 0,
    tracked: 0,
    min_battles: 0,
    newest: null,
    oldest: null,
  },
};

/**
 * Shared body for the Marks of Excellence board: `/players/marks` (the EU
 * shortcut), `/{region}/players/marks`, their `/page/[n]` routes and their
 * per-language views.
 *
 * Its own section rather than a column on the rating board, because it ranks a
 * count of achievements instead of a career average and the two put entirely
 * different people on top. ISR-cached, like the boards beside it.
 */
export async function MarksLandingView({
  region,
  language,
  strict = false,
  locale,
  page,
}: {
  region: Region;
  language: string | null;
  strict?: boolean;
  /** The route's own segment, for the server-rendered tabs and copy below. */
  locale: string;
  /**
   * The page of the ranking to render, from the `/page/[n]` route the proxy
   * sends `?page=` to. Absent on the per-language views, which have no such
   * route: the board keeps its buttons there, so nothing links a crawler at a
   * page the server would answer with the first one.
   */
  page?: number;
}) {
  // The mark levels are Wargaming's own words, already written down per
  // language, so the heading composes them from the catalogue rather than
  // spelling them out: a string that is mostly a catalogued name has one right
  // answer and is right in all thirty-six languages by construction.
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/players/list/marks/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const marks = tGame("marks.3");
  const marksName = tGame("marks.name");

  const { results, tiers, languages, coverage } = await buildSafe(
    () =>
      unicum.region(region).players.marks({
        limit: LIMIT,
        ...(language ? { lang: language } : {}),
        ...(strict ? { strict: "true" as const } : {}),
      }),
    EMPTY,
  );
  const rows = results as unknown as MarksRow[];

  assertPageInRange(page, rows.length, PAGINATION.SIZE.LEADERBOARD);

  const num = numberFormat(locale);
  const filterCounts = language
    ? languages.find((l) => l.code === language)
    : null;
  const langName = language ? languageDisplayName(language, locale) : null;
  const langCountry = language ? languageToCountryCode(language, region) : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.PLAYERS_MARKS(region)}
        page={page}
        total={rows.length}
        size={PAGINATION.SIZE.LEADERBOARD}
        locale={locale}
      />
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          {language ? (
            <div className="mb-2 inline-flex items-center gap-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
              {langCountry && (
                <Image
                  src={`/flags/m/${langCountry}.svg`}
                  alt=""
                  width={20}
                  height={15}
                  className="h-4 w-auto"
                />
              )}
              {langName} · {REGION_LABEL[region]}
            </div>
          ) : (
            <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
              {REGION_EMOJI[region]} {REGION_LABEL[region]}
            </div>
          )}
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t(language ? "heading.language" : "heading.plain", {
                marks,
                language: langName ?? "",
              })}
              wrap={{
                accent: (text) => <span className="text-brand">{text}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t(
              language ? (strict ? "intro.strict" : "intro.language") : "intro.all",
              {
                region: REGION_LABEL[region],
                language: langName ?? "",
                marks,
                battles: num.format(coverage.min_battles),
              },
            )}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active={PlayerBoard.Marks} locale={locale} />

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>
            {t(
              language ? (strict ? "board.strict" : "board.language") : "board.all",
              {
                count: num.format(rows.length),
                language: langName ?? "",
                marks,
              },
            )}
          </PanelTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PlayerLanguageSelect
              available={languages.map((l) => ({
                code: l.code,
                playersCount: l.total,
              }))}
              active={language}
              region={region}
              board={PlayerBoard.Marks}
              strict={strict}
            />
            {language && filterCounts && (
              <PlayerStrictModeToggle
                locale={locale}
                region={region}
                language={language}
                board={PlayerBoard.Marks}
                strict={strict}
                total={filterCounts.total}
                strictCount={filterCounts.strict}
              />
            )}
          </div>
        </PanelHeader>
        <PanelContent className="p-0">
          <MarksBoard
            region={region}
            initialResults={rows}
            tiers={tiers as number[]}
            language={language}
            strict={strict}
            page={page}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* What the ranking actually covers, said rather than implied. Marks come
          from the game portal one account at a time, so the board is of the
          accounts whose garage we have read, and a reader comparing it against
          a name they know to be missing deserves the reason. Same role the
          activity panel's `observed` plays. */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("coverage.title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3 text-sm text-fd-muted-foreground">
          <p>
            {t("coverage.body", {
              marksName,
              measured: num.format(coverage.measured),
              tracked: num.format(coverage.tracked),
            })}
          </p>
          {coverage.oldest && coverage.newest && (
            <p>
              <Interpolate
                template={t("coverage.freshness")}
                values={{
                  oldest: (
                    <LocalDate date={coverage.oldest} shape={DateShape.Day} />
                  ),
                  newest: (
                    <LocalDate date={coverage.newest} shape={DateShape.Day} />
                  ),
                }}
              />
            </p>
          )}
          <p>{t("coverage.profile")}</p>
        </PanelContent>
      </Panel>
    </div>
  );
}
