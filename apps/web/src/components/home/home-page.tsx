import {
  DiscordLogoIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "next/link";
import {
  Card as HomeCard,
  CardDescription,
  CardTitle,
} from "@/components/home/card";
import { FeatureBlock } from "@/components/home/feature-block";
import { RatingScale } from "@/components/home/rating-scale";
import { TopClansOverallPanel } from "@/components/home/top-clans-overall-panel";
import { LiveSection } from "@/components/home/live-section";
import { TopPlayers } from "@/components/home/top-players";
import { TopPlayersOverallPanel } from "@/components/home/top-players-overall-panel";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
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
import type {
  TopClansPeriod,
  TopClansSnapshot,
} from "@unicum.gg/core/wargaming/wot/clans/top";
import type {
  TopPlayersPeriod,
  TopPlayersSnapshot,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { buildSafe, unicum } from "@/services/sdk";
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
}: {
  regionOverride?: Region;
}) {
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
    buildSafe(() => unicum.streamers.list(), { results: [] }).then(
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
            <PanelTitle>Top players · Past 24 hours</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopPlayers
                  description={
                    <>
                      Ranked by <RatingMetricInlineSelect /> over the past 24
                      hours (min. 20 battles).
                    </>
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
            <PanelTitle>Top players · Past 7 days</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopPlayers
                  description={
                    <>
                      Ranked by <RatingMetricInlineSelect /> over the past 7
                      days (min. 140 battles).
                    </>
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
            <PanelTitle>Rating scale</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            <RatingScale />
          </PanelContent>
        </Panel>
      </div>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Join the community</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div
            className={`relative overflow-hidden rounded-lg ${styles.cardBorder} bg-linear-to-br from-fd-primary/5 via-fd-primary/10 to-fd-primary/5 p-8`}
          >
            <div className="absolute inset-0 bg-linear-to-br from-transparent via-fd-primary/5 to-transparent" />
            <div className="relative space-y-4 text-center">
              <h3 className="mb-2 text-xl font-semibold">
                Connect with WoT players
              </h3>
              <p className={`${styles.mutedText} mx-auto mb-6 max-w-md`}>
                Join our Discord to chat WoT stats, request features and
                report bugs. Or hop on GitHub to inspect the code and contribute.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={APP.EXTERNAL.DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "primary" })}
                >
                  <DiscordLogoIcon weight="fill" className="mr-2 size-4" />
                  Join Discord
                </Link>
                <Link
                  href={APP.EXTERNAL.GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <GithubLogoIcon weight="fill" className="mr-2 size-4" />
                  View on GitHub
                </Link>
              </div>
            </div>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>What you&apos;ll find here</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureBlock
              icon="📊"
              title="Player profiles"
              description="Detailed stats with overall + 24h / 7d / 30d deltas, WN7, WN8, WNX, and Personal Rating."
            />
            <FeatureBlock
              icon="🛡️"
              title="Clan pages"
              description="Members table with ratings, recent activity feed, description and clan metadata."
            />
            <FeatureBlock
              icon="📜"
              title="Clan history"
              description="Full timeline of every clan a player has been in, with roles and dates."
            />
            <FeatureBlock
              icon="⚡"
              title="Live updates"
              description="Tracked players refresh in the background every 24h via our snapshot system."
            />
            <FeatureBlock
              icon="🏆"
              title="Leaderboards"
              description="Top players (24h, 7d, all-time) and top clans ranked by WNX, computed from our snapshots."
            />
            <FeatureBlock
              icon="🛠️"
              title="Open source · AGPL"
              description="Code's on GitHub. Inspect, fork, contribute. No ads, opt-in analytics only."
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Quick start</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <HomeCard>
              <CardTitle>🔍 Search players or clans</CardTitle>
              <CardDescription>
                Press{" "}
                <code className="text-fd-foreground">⌘ K</code> /{" "}
                <code className="text-fd-foreground">Ctrl K</code> to open the
                search, then type a nickname or clan tag.
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>🌍 Switch region</CardTitle>
              <CardDescription>
                Use the{" "}
                <span className="text-fd-foreground">EU / NA / ASIA</span>{" "}
                selector in the navbar. Leaderboards update accordingly.
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>🏆 Browse leaderboards</CardTitle>
              <CardDescription>
                Top players (24h, 7d, all-time) and top clans ranked by average
                WNX, computed from our snapshots.
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>📊 Read the colors</CardTitle>
              <CardDescription>
                WR, WN7, WN8 and WNX share the same tier colors (orange → green
                → cyan → purple). See the scale above.
              </CardDescription>
            </HomeCard>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}

