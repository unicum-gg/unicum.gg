import { cookies } from "next/headers";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { PlayerLanguageChips } from "@/components/players/language-chips";
import { PlayerStrictModeToggle } from "@/components/players/strict-mode-toggle";
import { TopPlayersList } from "@/components/players/top-players-list";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  RATING_METRIC_LABEL,
  ratingMetricFromCookie,
} from "@/constants/rating";
import STORAGE from "@/constants/storage";
import { languageToCountryCode } from "@/lib/language-flags";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { getTopPlayersByLanguage } from "@/services/wargaming/wot/players/top/by-language";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@/services/wargaming/wot";

const LIMIT = 100;
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

/**
 * Shared body for both /players (EU default) and /<region>/players pages.
 * Pass `language: null` for the unfiltered landing and the language code
 * for /players/lang/<language>. `strict` is only meaningful when a
 * language is set: it narrows to players whose inferred language set is
 * exactly that one (no co-dominance with other languages). Mirrors the
 * /clans landing view.
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
  const cookieStore = await cookies();
  const metric = ratingMetricFromCookie(
    cookieStore.get(STORAGE.COOKIES.RATING)?.value,
  );
  const [results, stats] = await Promise.all([
    getTopPlayersByLanguage(region, metric, language, LIMIT, strict),
    getPlayerLanguageStats(region),
  ]);
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
                <img
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
                Top <span className="text-[#f25322]">{langName}</span> players
              </>
            ) : (
              <>
                Top <span className="text-[#f25322]">players</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {language ? (
              strict ? (
                <>
                  {REGION_LABEL[region]} players whose inferred clan-history
                  language is exclusively {langName}, ranked by{" "}
                  {RATING_METRIC_LABEL[metric]} (minimum 20,000 battles).
                </>
              ) : (
                <>
                  {REGION_LABEL[region]} players whose inferred clan-history
                  language set includes {langName}, ranked by{" "}
                  {RATING_METRIC_LABEL[metric]} (minimum 20,000 battles).
                </>
              )
            ) : (
              <>
                {REGION_LABEL[region]} leaderboard, ranked by all-time{" "}
                {RATING_METRIC_LABEL[metric]} (minimum 20,000 battles).
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

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Filter by language</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <PlayerLanguageChips
            available={stats.map((s) => ({
              code: s.code,
              playersCount: s.total,
            }))}
            active={language}
            region={region}
            strict={strict}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            {language
              ? strict
                ? `Top ${results.length} strictly ${langName} players`
                : `Top ${results.length} ${langName} players`
              : `Top ${results.length} players`}
          </PanelTitle>
          {language && filterCounts && (
            <PlayerStrictModeToggle
              region={region}
              language={language}
              strict={strict}
              total={filterCounts.total}
              strictCount={filterCounts.strict}
            />
          )}
        </PanelHeader>
        <PanelContent className="p-0">
          <TopPlayersList region={region} results={results} metric={metric} />
        </PanelContent>
      </Panel>
    </div>
  );
}
