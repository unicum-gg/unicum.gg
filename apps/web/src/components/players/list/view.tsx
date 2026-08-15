import Image from "next/image";
import { RatingScale } from "@/components/home/rating-scale";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
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
import { RatingMetric } from "@unicum.gg/shared";
import { languageToCountryCode } from "@/lib/language-flags";
import { buildSafe, unicum } from "@/services/sdk";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

/**
 * Inline metric label gated by `html[data-rating-metric]` CSS. All three
 * variants ship in the HTML, only the matching one shows. Keeps the page
 * output identical regardless of the user's rating cookie.
 */
function MetricInline() {
  return (
    <>
      <span data-rating-col="wn7">WN7</span>
      <span data-rating-col="wn8">WN8</span>
      <span data-rating-col="wnx">WNX</span>
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
}: {
  region: Region;
  language: string | null;
  strict?: boolean;
}) {
  // The landing consumes its own public API through the SDK: the lifetime
  // by-language boards (rows carry their inferred languages) + the language
  // populations for the chips.
  const api = unicum.region(region).players;
  const topQuery = (metric: "wn7" | "wn8" | "wnx") => ({
    metric,
    limit: LIMIT,
    ...(language ? { language } : { languages: "true" as const }),
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
  const stats = languageStats.results;
  const filterCounts = language ? stats.find((s) => s.code === language) : null;
  const langName = language ? languageDisplayName(language) : null;
  const langCountry = language ? languageToCountryCode(language, region) : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
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
              <>
                Top <span className="text-brand">{langName}</span> players
              </>
            ) : (
              <>
                Top <span className="text-brand">players</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {language ? (
              strict ? (
                <>
                  {REGION_LABEL[region]} players whose inferred clan-history
                  language is exclusively {langName}, ranked by <MetricInline />
                  {" "}(minimum 10,000 battles).
                </>
              ) : (
                <>
                  {REGION_LABEL[region]} players whose inferred clan-history
                  language set includes {langName}, ranked by <MetricInline />
                  {" "}(minimum 10,000 battles).
                </>
              )
            ) : (
              <>
                {REGION_LABEL[region]} leaderboard, ranked by all-time
                {" "}<MetricInline /> (minimum 20,000 battles).
              </>
            )}
          </p>
          <div className="mt-6 flex justify-center">
            <LeaderboardTabs
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
      <PlayersModeTabs region={region} active="overall" />

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>
            Top {wnxResults.length.toLocaleString("en-US")}{" "}
            {language
              ? strict
                ? `strictly ${langName} players`
                : `${langName} players`
              : "players"}{" "}
            by <MetricInline />
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
            />
          </div>
          <div data-rating-col="wn8">
            <TopPlayersBoard
              region={region}
              metric={RatingMetric.Wn8}
              results={wn8Results}
            />
          </div>
          <div data-rating-col="wnx">
            <TopPlayersBoard
              region={region}
              metric={RatingMetric.Wnx}
              results={wnxResults}
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Rating scale</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <RatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
