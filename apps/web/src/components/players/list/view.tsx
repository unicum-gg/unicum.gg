import { numberFormat } from "@/lib/format";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import Image from "next/image";
import {
  RatingScale,
  RatingScaleTitle,
} from "@/components/home/rating-scale";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import { PlayerLanguageSelect } from "@/components/players/list/language-select";
import { PlayerStrictModeToggle } from "@/components/players/list/strict-mode-toggle";
import { TopPlayersBoard } from "@/components/players/list/top-players-board";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RatingMetric, languageToCountryCode } from "@unicum.gg/shared";
import { buildSafe, unicum } from "@/services/sdk";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import { languageDisplayName } from "@/lib/language-name";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;
/**
 * Inline metric label gated by `html[data-rating-metric]` CSS. All three
 * variants ship in the HTML, only the matching one shows. Keeps the page
 * output identical regardless of the user's rating cookie.
 */
async function MetricInline({ locale }: { locale: string }) {
  const { t } = await getTranslation("components/players/list/view", locale);
  return (
    <>
      <span data-rating-col="wn7">{t("wn7")}</span>
      <span data-rating-col="wn8">{t("wn8")}</span>
      <span data-rating-col="wnx">{t("wnx")}</span>
    </>
  );
}

/**
 * Shared body for both /players (EU default) and /<region>/players pages.
 * Pass `language: null` for the unfiltered landing and the language code
 * for /players/lang/<language>. `strict` narrows to players whose
 * inferred language set is exactly the requested one (no co-dominance).
 *
 * The view renders all three metric variants in parallel and gates them
 * via `data-rating-col` so the same HTML serves every visitor. The
 * cookie picks which is visible via CSS (rule lives in `globals.css`).
 */
export async function PlayersLandingView({
  region,
  language,
  strict = false,
  locale,
  page,
}: {
  region: Region;
  language: string | null;
  strict?: boolean;
  /** The route's own segment, for the server-rendered tabs below. */
  locale: string;
  /**
   * The page of the ranking to render, from the `/page/[n]` route the proxy
   * sends `?page=` to. Server-rendered rather than swapped in after hydration,
   * which is the whole point: a crawler reads the HTML and leaves.
   *
   * Absent where no such route exists. The per-language landings render this
   * same view and have none, so their board keeps its buttons and nothing links
   * a crawler at a page the server would answer with the first one.
   */
  page?: number;
}) {
  // The landing consumes its own public API through the SDK: the lifetime
  // by-language boards (rows carry their inferred languages) + the language
  // populations for the chips.
  const { t } = await getTranslation("components/players/list/view", locale);
  const api = unicum.region(region).players;
  const topQuery = (metric: "wn7" | "wn8" | "wnx") => ({
    metric,
    limit: LIMIT,
    ...(language ? { lang: language } : { languages: "true" as const }),
    ...(strict ? { strict: "true" as const } : {}),
  });
  const EMPTY_TOP = { results: [], computed_at: null };
  const [wn7Top, wn8Top, wnxTop, languageStats] = await Promise.all([
    buildSafe(() => api.top(topQuery("wn7")), EMPTY_TOP),
    buildSafe(() => api.top(topQuery("wn8")), EMPTY_TOP),
    buildSafe(() => api.top(topQuery("wnx")), EMPTY_TOP),
    buildSafe(() => api.languages(), { results: [] }),
  ]);
  const wn7Results = wn7Top.results as TopPlayerByLanguageResult[];
  const wn8Results = wn8Top.results as TopPlayerByLanguageResult[];
  const wnxResults = wnxTop.results as TopPlayerByLanguageResult[];
  // All three metrics rank the same eligible set, so their lengths agree; the
  // longest is what bounds the pages either way.
  const pagedRows = Math.max(wn7Results.length, wn8Results.length, wnxResults.length);
  assertPageInRange(page, pagedRows, PAGINATION.SIZE.LEADERBOARD);
  const stats = languageStats.results;
  const filterCounts = language ? stats.find((s) => s.code === language) : null;
  const langName = language ? languageDisplayName(language, locale) : null;
  const langCountry = language ? languageToCountryCode(language, region) : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.PLAYERS(region)}
        page={page}
        total={pagedRows}
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
            {language ? (
              <Interpolate
                template={t("heading.language", { language: langName ?? "" })}
                wrap={{
                  accent: (text) => (
                    <span className="text-brand">{text}</span>
                  ),
                }}
              />
            ) : (
              <Interpolate template={t("heading.plain")} wrap={{
                  accent: (text) => (
                    <span className="text-brand">{text}</span>
                  ),
                }} />
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {/* The metric is a picker, not a word, so it rides the sentence as a
                node: half the languages we publish put it somewhere else. */}
            <Interpolate
              template={t(
                language ? (strict ? "intro.strict" : "intro.language") : "intro.all",
                { region: REGION_LABEL[region], language: langName ?? "" },
              )}
              values={{ metric: <MetricInline locale={locale} /> }}
            />
          </p>
          <div className="mt-6 flex justify-center">
            <LeaderboardTabs
              locale={locale}
              current="players"
              region={region}
              language={language}
              strict={strict}
            />
          </div>
        </PanelContent>
      </Panel>

      {/* Game-mode boards (Overall WNX vs Steel Hunter HR), on every player
          landing including the per-language pages, mirroring the clan landing's
          stronghold tabs. */}
      <PanelSeparator />
      <PlayersModeTabs region={region} active="overall" locale={locale} />

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>
            <Interpolate
              template={t(
                language ? (strict ? "board.strict" : "board.language") : "board.all",
                {
                  count: numberFormat(locale).format(wnxResults.length),
                  language: langName ?? "",
                },
              )}
              values={{
                metric: (
                  <RatingMetricInlineSelect className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4" />
                ),
              }}
            />
          </PanelTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PlayerLanguageSelect
              available={stats.map((s) => ({
                code: s.code,
                playersCount: s.total,
              }))}
              active={language}
              region={region}
              strict={strict}
            />
            {language && filterCounts && (
              <PlayerStrictModeToggle
                locale={locale}
                region={region}
                language={language}
                strict={strict}
                total={filterCounts.total}
                strictCount={filterCounts.strict}
              />
            )}
          </div>
        </PanelHeader>
        <PanelContent className="p-0">
          <div data-rating-col="wn7">
            <TopPlayersBoard
              region={region}
              metric={RatingMetric.Wn7}
              results={wn7Results}
              page={page}
            />
          </div>
          <div data-rating-col="wn8">
            <TopPlayersBoard
              region={region}
              metric={RatingMetric.Wn8}
              results={wn8Results}
              page={page}
            />
          </div>
          <div data-rating-col="wnx">
            <TopPlayersBoard
              region={region}
              metric={RatingMetric.Wnx}
              results={wnxResults}
              page={page}
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>
            <RatingScaleTitle />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <RatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
