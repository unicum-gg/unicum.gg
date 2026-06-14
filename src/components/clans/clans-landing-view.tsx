import { cookies } from "next/headers";
import { LanguageChips } from "@/components/clans/language-chips";
import { StrictModeToggle } from "@/components/clans/strict-mode-toggle";
import { TopClansList } from "@/components/clans/top-clans-list";
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
import {
  getAvailableLanguages,
  getLanguageFilterCounts,
} from "@/services/clans/available-languages";
import { getTopClansByLanguage } from "@/services/wargaming/wot/clans/top/by-language";
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
 * Shared body for both /clans (EU default) and /<region>/clans pages. Pass
 * `language: null` for the unfiltered landing and the language code for
 * /clans/lang/<language>. `strict` is only meaningful when a language is
 * set: it restricts the leaderboard to clans that declared ONLY that
 * language (no `de + en` mixed declarations).
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
  const cookieStore = await cookies();
  const metric = ratingMetricFromCookie(
    cookieStore.get(STORAGE.COOKIES.RATING)?.value,
  );
  const [results, available, filterCounts] = await Promise.all([
    getTopClansByLanguage(region, metric, language, LIMIT, strict),
    getAvailableLanguages(region),
    language ? getLanguageFilterCounts(region, language) : null,
  ]);
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
                  their only language, ranked by{" "}
                  {RATING_METRIC_LABEL[metric]} averaged across their tracked
                  members (minimum 25 members).
                </>
              ) : (
                <>
                  {REGION_LABEL[region]} clans that declared {langName} as one
                  of their languages, ranked by{" "}
                  {RATING_METRIC_LABEL[metric]} averaged across their tracked
                  members (minimum 25 members).
                </>
              )
            ) : (
              <>
                {REGION_LABEL[region]} leaderboard, ranked by{" "}
                {RATING_METRIC_LABEL[metric]} averaged across the tracked
                members of each clan (minimum 50 members).
              </>
            )}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Filter by language</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <LanguageChips
            available={available}
            active={language}
            region={region}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            {language
              ? strict
                ? `Top ${results.length} strictly ${langName} clans`
                : `Top ${results.length} ${langName} clans`
              : `Top ${results.length} clans`}
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
          <TopClansList region={region} results={results} metric={metric} />
        </PanelContent>
      </Panel>
    </div>
  );
}
