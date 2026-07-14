import Image from "next/image";
import { LanguageChips } from "@/components/clans/language-chips";
import { StrictModeToggle } from "@/components/clans/strict-mode-toggle";
import { StrongholdTierTabs } from "@/components/clans/stronghold-tier-tabs";
import { TopClansList } from "@/components/clans/top-clans-list";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RatingMetric } from "@unicum.gg/core/constants/rating";
import { languageToCountryCode } from "@/lib/language-flags";
import { getLanguageStats } from "@/services/clans/available-languages";
import { getTopClansByLanguage } from "@/services/wargaming/wot/clans/top/by-language";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";

const LIMIT = 100;
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

/**
 * Inline metric label gated by `html[data-rating-metric]` CSS. All three
 * variants ship in the HTML, only the matching one shows. Keeps the page
 * output identical regardless of the user's rating cookie so the
 * response can be cached without varying.
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
 * Shared body for both /clans (EU default) and /<region>/clans pages. Pass
 * `language: null` for the unfiltered landing and the language code for
 * /clans/lang/<language>. `strict` narrows to clans that declared ONLY
 * the requested language.
 *
 * The view renders all three metric variants in parallel and gates them
 * via `data-rating-col` so the same HTML serves every visitor. The
 * cookie picks which is visible via CSS (rule lives in `globals.css`).
 */
export async function ClansLandingView({
  region,
  language,
  strict = false,
}: {
  region: Region;
  language: string | null;
  strict?: boolean;
}) {
  const [wn7Results, wn8Results, wnxResults, stats] = await Promise.all([
    getTopClansByLanguage(region, RatingMetric.Wn7, language, LIMIT, strict),
    getTopClansByLanguage(region, RatingMetric.Wn8, language, LIMIT, strict),
    getTopClansByLanguage(region, RatingMetric.Wnx, language, LIMIT, strict),
    getLanguageStats(region),
  ]);
  const filterCounts = language ? stats.find((s) => s.code === language) : null;
  const langName = language ? languageDisplayName(language) : null;
  const langCountry = language ? languageToCountryCode(language, region) : null;
  // All three metrics use the same eligibility filter, so the row count
  // is identical across them in practice. Pick one as the canonical
  // count for the panel title.
  const totalCount = wnxResults.length;

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
                Top <span className="text-[#f25322]">{langName}</span> clans
              </>
            ) : (
              <>
                Top <span className="text-[#f25322]">clans</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {language ? (
              strict ? (
                <>
                  {REGION_LABEL[region]} clans that declared {langName} as
                  their only language, ranked by <MetricInline /> averaged
                  across their tracked members (minimum 25 members with
                  battles).
                </>
              ) : (
                <>
                  {REGION_LABEL[region]} clans that declared {langName} as one
                  of their languages, ranked by <MetricInline /> averaged
                  across their tracked members (minimum 25 members with
                  battles).
                </>
              )
            ) : (
              <>
                {REGION_LABEL[region]} leaderboard, ranked by <MetricInline />
                {" "}averaged across the tracked members of each clan
                (minimum 50 members with battles).
              </>
            )}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <LeaderboardTabs
              current="clans"
              region={region}
              language={language}
              strict={strict}
            />
          </div>
        </PanelContent>
      </Panel>

      {!language && (
        <>
          <PanelSeparator />
          <StrongholdTierTabs region={region} />
        </>
      )}

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Filter by language</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <LanguageChips
            available={stats.map((s) => ({
              code: s.code,
              clansCount: s.total,
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
                ? `Top ${totalCount} strictly ${langName} clans`
                : `Top ${totalCount} ${langName} clans`
              : `Top ${totalCount} clans`}
          </PanelTitle>
          {language && filterCounts && (
            <StrictModeToggle
              region={region}
              language={language}
              strict={strict}
              total={filterCounts.total}
              strictCount={filterCounts.strict}
            />
          )}
        </PanelHeader>
        <PanelContent className="p-0">
          <div data-rating-col="wn7">
            <TopClansList
              region={region}
              results={wn7Results}
              metric={RatingMetric.Wn7}
            />
          </div>
          <div data-rating-col="wn8">
            <TopClansList
              region={region}
              results={wn8Results}
              metric={RatingMetric.Wn8}
            />
          </div>
          <div data-rating-col="wnx">
            <TopClansList
              region={region}
              results={wnxResults}
              metric={RatingMetric.Wnx}
            />
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
