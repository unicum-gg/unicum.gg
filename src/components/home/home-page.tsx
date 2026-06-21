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
import { TopClans } from "@/components/home/top-clans";
import { TopClansLeaderboardLink } from "@/components/home/top-clans-leaderboard-link";
import { TopPlayers } from "@/components/home/top-players";
import { TopPlayersLeaderboardLink } from "@/components/home/top-players-leaderboard-link";
import { HeroVideo } from "@/components/home/hero-video";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import { RATING_METRICS, RatingMetric } from "@/constants/rating";
import { styles } from "@/lib/styles";
import { getTopClansByMetricByRegions } from "@/services/wargaming/wot/clans/top";
import {
  getTopPlayersByMetricByRegions,
  TopPlayersPeriod,
} from "@/services/wargaming/wot/players/top";
import { type Region, REGIONS } from "@/services/wargaming/wot";

const TOP_LIMIT = 9;
const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

export async function HomePage({
  regionOverride,
}: {
  regionOverride?: Region;
}) {
  const [
    topClansByMetric,
    topPlayersDayByMetric,
    topPlayersWeekByMetric,
    topPlayersOverallByMetric,
  ] = await Promise.all([
    Promise.all(
      RATING_METRICS.map((m) =>
        getTopClansByMetricByRegions(REGIONS, m, TOP_LIMIT),
      ),
    ),
    Promise.all(
      RATING_METRICS.map((m) =>
        getTopPlayersByMetricByRegions(
          REGIONS,
          m,
          TopPlayersPeriod.Day,
          TOP_LIMIT,
        ),
      ),
    ),
    Promise.all(
      RATING_METRICS.map((m) =>
        getTopPlayersByMetricByRegions(
          REGIONS,
          m,
          TopPlayersPeriod.Week,
          TOP_LIMIT,
        ),
      ),
    ),
    Promise.all(
      RATING_METRICS.map((m) =>
        getTopPlayersByMetricByRegions(
          REGIONS,
          m,
          TopPlayersPeriod.Overall,
          TOP_LIMIT,
        ),
      ),
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div
        className={`relative aspect-[16/10] ${styles.borderX} flex w-full select-none items-center justify-center overflow-hidden sm:aspect-5/2 md:aspect-auto md:h-64 ${styles.screenLines}`}
      >
        <HeroVideo />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="relative z-10 space-y-4 px-4 text-center sm:space-y-6 sm:px-6">
          <h1 className="text-2xl font-bold text-white sm:text-4xl md:text-6xl">
            {APP.NAME}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/90 sm:text-lg md:text-xl">
            World of Tanks player and clan stats. Track your progress, compare
            with others.
          </p>
        </div>
      </div>

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

        <Panel className="flex flex-col" screenLines={false}>
          <PanelHeader
            screenLines={false}
            className="flex items-center justify-between gap-3"
          >
            <PanelTitle>Top players · Overall</PanelTitle>
            <TopPlayersLeaderboardLink regionOverride={regionOverride} />
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopPlayers
                  description={
                    <>
                      Ranked by all-time <RatingMetricInlineSelect /> (min.
                      20,000 battles).
                    </>
                  }
                  initial={topPlayersOverallByMetric[i]}
                  metric={m}
                  regionOverride={regionOverride}
                />
              </div>
            ))}
          </PanelContent>
        </Panel>
      </div>

      <PanelSeparator />

      <div className="grid lg:grid-cols-2 *:min-w-0">
        <Panel className="flex flex-col">
          <PanelHeader className="flex items-center justify-between gap-3">
            <PanelTitle>Top clans</PanelTitle>
            <TopClansLeaderboardLink regionOverride={regionOverride} />
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            {RATING_METRICS.map((m, i) => (
              <div key={m} data-rating-col={RATING_COL[m]}>
                <TopClans
                  initial={topClansByMetric[i]}
                  metric={m}
                  regionOverride={regionOverride}
                />
              </div>
            ))}
          </PanelContent>
        </Panel>

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
              description="Code's on GitHub. Inspect, fork, contribute. No login to view stats, opt-in analytics only."
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
