import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import Image from "next/image";
import { BoardUpdated } from "@/components/board-updated";
import {
  RatingScale,
  RatingScaleTitle,
} from "@/components/home/rating-scale";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { PlayerBoard } from "@/components/players/list/boards";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import { TopPlayersIntro } from "@/components/players/list/top-players-intro";
import { TopPlayersPanel } from "@/components/players/list/top-players-panel";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  RATING_METRICS,
  RatingMetric,
  languageToCountryCode,
} from "@unicum.gg/shared";
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
 * Shared body for both /players (EU default) and /<region>/players pages.
 * Pass `language: null` for the unfiltered landing and the language code
 * for /players/lang/<language>. `strict` narrows to players whose
 * inferred language set is exactly the requested one (no co-dominance).
 *
 * The view renders every metric variant in parallel and gates them
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
  const topQuery = (metric: RatingMetric) => ({
    metric,
    limit: LIMIT,
    ...(language ? { lang: language } : { languages: "true" as const }),
    ...(strict ? { strict: "true" as const } : {}),
  });
  const EMPTY_TOP = { results: [], computed_at: null };
  const [tops, languageStats] = await Promise.all([
    Promise.all(
      RATING_METRICS.map((metric) =>
        buildSafe(() => api.top(topQuery(metric)), EMPTY_TOP),
      ),
    ),
    buildSafe(() => api.languages(), { results: [] }),
  ]);
  const results = Object.fromEntries(
    RATING_METRICS.map((metric, i) => [
      metric,
      tops[i].results as TopPlayerByLanguageResult[],
    ]),
  ) as Record<RatingMetric, TopPlayerByLanguageResult[]>;
  const top = (metric: RatingMetric) => tops[RATING_METRICS.indexOf(metric)];
  // Every metric ranks the same eligible set, so their lengths agree; the
  // longest is what bounds the pages either way.
  const pagedRows = Math.max(...Object.values(results).map((r) => r.length));
  assertPageInRange(page, pagedRows, PAGINATION.SIZE.LEADERBOARD);
  const stats = languageStats.results;
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
        <PanelContent className="relative px-4 py-12 text-center">
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
            <TopPlayersIntro
              variant={language ? (strict ? "strict" : "language") : "all"}
              region={REGION_LABEL[region]}
              language={langName ?? ""}
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
          <BoardUpdated
            at={top(RatingMetric.Wnx).computed_at ?? top(RatingMetric.Wn8).computed_at}
          />
        </PanelContent>
      </Panel>

      {/* Game-mode boards (Overall WNX vs Rampage MR), on every player
          landing including the per-language pages, mirroring the clan landing's
          stronghold tabs. */}
      <PanelSeparator />
      <PlayersModeTabs region={region} active={PlayerBoard.Overall} locale={locale} />

      <PanelSeparator />

      <TopPlayersPanel
        region={region}
        page={page}
        initial={results}
        title={{
          key: language ? (strict ? "board.strict" : "board.language") : "board.all",
          language: langName ?? undefined,
        }}
        language={language}
        strict={strict}
        languageStats={stats}
      />

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
