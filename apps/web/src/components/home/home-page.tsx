import {
  DiscordLogoIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import {
  Card as HomeCard,
  CardDescription,
  CardTitle,
} from "@/components/home/card";
import { FeatureBlock } from "@/components/home/feature-block";
import {
  RatingScale,
  RatingScaleTitle,
} from "@/components/home/rating-scale";
import { TopClansOverallPanel } from "@/components/home/top-clans-overall-panel";
import { LiveSection } from "@/components/home/live-section";
import { TopPlayers } from "@/components/home/top-players";
import { TopPlayersOverallPanel } from "@/components/home/top-players-overall-panel";
import { Interpolate } from "@/components/interpolate";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { Kbd } from "@/components/ui/kbd";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import { RATING_METRICS, RatingMetric, type LiveStreamer } from "@unicum.gg/shared";
import { styles } from "@/lib/styles";
import { getTranslation } from "@/lib/translations.server";
import type {
  TopClansPeriod,
  TopClansSnapshot,
} from "@unicum.gg/core/wargaming/wot/clans/top";
import type {
  TopPlayersPeriod,
  TopPlayersSnapshot,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { buildSafe, optional, unicum } from "@/services/sdk";
import { type Region, REGIONS } from "@unicum.gg/wargaming";

const TOP_LIMIT = 9;
const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

// The home consumes its own public API through the SDK: one `/top` call per
// (region, metric, period), all precomputed leaderboards server-side, plus
// the live-streamers snapshot. Next memoizes identical fetches per render.
async function playersTopByRegions(
  metric: RatingMetric,
  period: `${TopPlayersPeriod}`,
): Promise<Record<Region, TopPlayersSnapshot>> {
  const entries = await Promise.all(
    REGIONS.map(async (region) => {
      const { results, computed_at } = await buildSafe(
        () =>
          unicum
            .region(region)
            .players.top({ metric: RATING_COL[metric], period, limit: TOP_LIMIT }),
        { results: [], computed_at: null },
      );
      return [
        region,
        {
          results,
          computedAt: computed_at ? new Date(computed_at) : null,
        } as unknown as TopPlayersSnapshot,
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Region, TopPlayersSnapshot>;
}

async function clansTopByRegions(
  metric: RatingMetric,
  period: `${TopClansPeriod}`,
): Promise<Record<Region, TopClansSnapshot>> {
  const entries = await Promise.all(
    REGIONS.map(async (region) => {
      const { results, computed_at } = await buildSafe(
        () =>
          unicum
            .region(region)
            .clans.top({ metric: RATING_COL[metric], period, limit: TOP_LIMIT }),
        { results: [], computed_at: null },
      );
      return [
        region,
        {
          results,
          computedAt: computed_at ? new Date(computed_at) : null,
        } as unknown as TopClansSnapshot,
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Region, TopClansSnapshot>;
}

export async function HomePage({
  regionOverride,
  locale,
}: {
  regionOverride?: Region;
  locale: string;
}) {
  const { t } = await getTranslation("components/home/home-page", locale);
  // The four "Ranked by ..." lines live in ONE namespace, read here and by the
  // overall panel: siblings that must read alike have to be decided in the same
  // request, or the model writes each on its own and French gets an article in
  // one and not the next.
  const { t: tRanked } = await getTranslation(
    "components/home/ranked-by",
    locale,
  );
  const [
    topClansOverallByMetric,
    topClansMonthByMetric,
    topPlayersDayByMetric,
    topPlayersWeekByMetric,
    topPlayersOverallByMetric,
    topPlayersMonthByMetric,
    liveStreamers,
  ] = await Promise.all([
    Promise.all(RATING_METRICS.map((m) => clansTopByRegions(m, "overall"))),
    Promise.all(RATING_METRICS.map((m) => clansTopByRegions(m, "30d"))),
    Promise.all(RATING_METRICS.map((m) => playersTopByRegions(m, "24h"))),
    Promise.all(RATING_METRICS.map((m) => playersTopByRegions(m, "7d"))),
    Promise.all(RATING_METRICS.map((m) => playersTopByRegions(m, "overall"))),
    Promise.all(RATING_METRICS.map((m) => playersTopByRegions(m, "30d"))),
    optional(() => unicum.streamers.list(), { results: [] }).then(
      (r) => r.results as unknown as LiveStreamer[],
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Live streamers rail when players are streaming (and the visitor hasn't
          hidden it), otherwise the video hero. The toggle + preference live in
          the client `LiveSection`. */}
      <LiveSection streamers={liveStreamers} />

      <PanelSeparator />

      <div className="grid lg:grid-cols-3 *:min-w-0">
        <Panel className="flex flex-col lg:border-r-0">
          <PanelHeader>
            <PanelTitle>{t("top-players.day.title")}</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopPlayers
                  description={
                    <Interpolate
                      template={tRanked("day")}
                      values={{ metric: <RatingMetricInlineSelect /> }}
                    />
                  }
                  initial={topPlayersDayByMetric[i]}
                  metric={m}
                  regionOverride={regionOverride}
                />
              </div>
            ))}
          </PanelContent>
        </Panel>

        <Panel
          className="flex flex-col lg:border-r-0"
          screenLines={false}
        >
          <PanelHeader screenLines={false}>
            <PanelTitle>{t("top-players.week.title")}</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopPlayers
                  description={
                    <Interpolate
                      template={tRanked("week")}
                      values={{ metric: <RatingMetricInlineSelect /> }}
                    />
                  }
                  initial={topPlayersWeekByMetric[i]}
                  metric={m}
                  regionOverride={regionOverride}
                />
              </div>
            ))}
          </PanelContent>
        </Panel>

        <TopPlayersOverallPanel
          overallByMetric={topPlayersOverallByMetric}
          monthByMetric={topPlayersMonthByMetric}
          regionOverride={regionOverride}
        />
      </div>

      <PanelSeparator />

      <div className="grid lg:grid-cols-2 *:min-w-0">
        <TopClansOverallPanel
          overallByMetric={topClansOverallByMetric}
          monthByMetric={topClansMonthByMetric}
          regionOverride={regionOverride}
        />

        <Panel className="flex flex-col lg:border-l-0" screenLines={false}>
          <PanelHeader screenLines={false}>
            <PanelTitle>
            <RatingScaleTitle />
          </PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            <RatingScale />
          </PanelContent>
        </Panel>
      </div>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("community.title")}</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div
            className={`relative overflow-hidden rounded-lg ${styles.cardBorder} bg-linear-to-br from-fd-primary/5 via-fd-primary/10 to-fd-primary/5 p-8`}
          >
            <div className="absolute inset-0 bg-linear-to-br from-transparent via-fd-primary/5 to-transparent" />
            <div className="relative space-y-4 text-center">
              <h3 className="mb-2 text-xl font-semibold">
                {t("community.heading")}
              </h3>
              <p className={`${styles.mutedText} mx-auto mb-6 max-w-md`}>
                {t("community.description")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={APP.EXTERNAL.DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "primary" })}
                >
                  <DiscordLogoIcon weight="fill" className="mr-2 size-4" />
                  {t("community.discord")}
                </Link>
                <Link
                  href={APP.EXTERNAL.GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <GithubLogoIcon weight="fill" className="mr-2 size-4" />
                  {t("community.github")}
                </Link>
              </div>
            </div>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("features.title")}</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureBlock
              icon="📊"
              title={t("features.profiles.title")}
              description={t("features.profiles.description")}
            />
            <FeatureBlock
              icon="🛡️"
              title={t("features.clans.title")}
              description={t("features.clans.description")}
            />
            <FeatureBlock
              icon="📜"
              title={t("features.history.title")}
              description={t("features.history.description")}
            />
            <FeatureBlock
              icon="⚡"
              title={t("features.live.title")}
              description={t("features.live.description")}
            />
            <FeatureBlock
              icon="🏆"
              title={t("features.leaderboards.title")}
              description={t("features.leaderboards.description")}
            />
            <FeatureBlock
              icon="🛠️"
              title={t("features.open-source.title")}
              description={t("features.open-source.description")}
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("quick-start.title")}</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <HomeCard>
              <CardTitle>{t("quick-start.search.title")}</CardTitle>
              <CardDescription>
                <Interpolate
                  template={t("quick-start.search.description")}
                  values={{
                    shortcut: (
                      <>
                        <Kbd>⌘</Kbd> <Kbd>K</Kbd> / <Kbd>{t("ctrl")}</Kbd> <Kbd>K</Kbd>
                      </>
                    ),
                  }}
                />
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>{t("quick-start.region.title")}</CardTitle>
              <CardDescription>
                <Interpolate
                  template={t("quick-start.region.description")}
                  values={{
                    selector: (
                      <span className="text-fd-foreground">{t("eu-na-asia")}</span>
                    ),
                  }}
                />
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>{t("quick-start.leaderboards.title")}</CardTitle>
              <CardDescription>
                {t("quick-start.leaderboards.description")}
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>{t("quick-start.colors.title")}</CardTitle>
              <CardDescription>
                {t("quick-start.colors.description")}
              </CardDescription>
            </HomeCard>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}

