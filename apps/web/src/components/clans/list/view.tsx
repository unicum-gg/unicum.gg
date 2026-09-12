import { numberFormat } from "@/lib/format";
import Image from "next/image";
import { ClanLanguageSelect } from "@/components/clans/list/language-select";
import { StrictModeToggle } from "@/components/clans/list/strict-mode-toggle";
import { StrongholdTierTabs } from "@/components/clans/list/stronghold/tier-tabs";
import { TopClansBoard } from "@/components/clans/list/top-clans-board";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
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
import type { TopClanByLanguageResult } from "@/services/wargaming/wot/clans/top/by-language";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { languageDisplayName } from "@/lib/language-name";

const LIMIT = 100;
/**
 * Inline metric label gated by `html[data-rating-metric]` CSS. All three
 * variants ship in the HTML, only the matching one shows. Keeps the page
 * output identical regardless of the user's rating cookie so the
 * response can be cached without varying.
 */
async function MetricInline({ locale }: { locale: string }) {
  const { t } = await getTranslation("components/clans/list/view", locale);
  return (
    <>
      <span data-rating-col="wn7">{t("wn7")}</span>
      <span data-rating-col="wn8">{t("wn8")}</span>
      <span data-rating-col="wnx">{t("wnx")}</span>
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
  locale,
  strict = false,
}: {
  region: Region;
  language: string | null;
  locale: string;
  strict?: boolean;
}) {
  const { t } = await getTranslation("components/clans/list/view", locale);
  // The landing consumes its own public API through the SDK (see the players
  // landing for the same pattern).
  const api = unicum.region(region).clans;
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
  const wn7Results = wn7Top.results as unknown as TopClanByLanguageResult[];
  const wn8Results = wn8Top.results as unknown as TopClanByLanguageResult[];
  const wnxResults = wnxTop.results as unknown as TopClanByLanguageResult[];
  const stats = languageStats.results;
  const filterCounts = language ? stats.find((s) => s.code === language) : null;
  const langName = language ? languageDisplayName(language, locale) : null;
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
            <Interpolate
              template={t(
                language
                  ? strict
                    ? "intro.strict"
                    : "intro.language"
                  : "intro.all",
                { region: REGION_LABEL[region], language: langName ?? "" },
              )}
              values={{ metric: <MetricInline locale={locale} /> }}
            />
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <LeaderboardTabs
              locale={locale}
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
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>
            <Interpolate
              template={t(
                language
                  ? strict
                    ? "board.strict"
                    : "board.language"
                  : "board.all",
                {
                  count: numberFormat(locale).format(totalCount),
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
            <ClanLanguageSelect
              available={stats.map((s) => ({
                code: s.code,
                clansCount: s.total,
              }))}
              active={language}
              region={region}
              strict={strict}
            />
            {language && filterCounts && (
              <StrictModeToggle
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
          {/* No `omitBoard`: the crests a clan wears here are its stronghold
              placings, which this table is not one of. The rating board had its
              own crest and had to be hidden on its own page; it no longer
              exists. */}
          <div data-rating-col="wn7">
            <TopClansBoard
              region={region}
              results={wn7Results}
              metric={RatingMetric.Wn7}
            />
          </div>
          <div data-rating-col="wn8">
            <TopClansBoard
              region={region}
              results={wn8Results}
              metric={RatingMetric.Wn8}
            />
          </div>
          <div data-rating-col="wnx">
            <TopClansBoard
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
