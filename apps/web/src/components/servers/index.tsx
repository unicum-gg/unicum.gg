import {
  type PlayerDistribution,
  type ServerComparison,
  type ServerStats,
  ServerStatsRange,
} from "@unicum.gg/shared";
import { REGION_EMOJI, REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { BattleShares } from "./battle-shares";
import { ServersDashboard } from "./dashboard";
import { DistributionPanel } from "./distribution-panel";
import { formatMoment } from "./format";
import { ServersLiveHeader } from "./live-header";

/**
 * The servers page for one region.
 *
 * The default range is rendered on the server so the page has its numbers in
 * the prerendered HTML, and the range switcher takes over from there without
 * making the page dynamic. The headline count is the exception: it comes from
 * Wargaming over SSE, so it is the same instant the game shows rather than the
 * last five-minute sample.
 */

const DEFAULT_RANGE = ServerStatsRange.Day;

/** What a build with no database (or a failed endpoint) prerenders: an empty
 * shell that heals on its first revalidation, like every other `buildSafe`
 * fallback on the site. */
function emptyStats(region: Region): ServerStats {
  return {
    region,
    range: DEFAULT_RANGE,
    servers: [],
    points: [],
    clusters: [],
    current: null,
    average: 0,
    peak: null,
    trough: null,
    allTimePeak: null,
    rhythm: [],
    since: null,
  };
}

export async function ServersView({ region }: { region: Region }) {
  const [stats, comparison, distribution] = await Promise.all([
    buildSafe(
      () => unicum.region(region).server.stats(DEFAULT_RANGE),
      emptyStats(region),
    ) as Promise<ServerStats>,
    buildSafe(() => unicum.servers.compare(DEFAULT_RANGE), {
      range: DEFAULT_RANGE,
      regions: [],
    }) as Promise<ServerComparison>,
    // The endpoint answers 404 until the hourly cron has run for this region,
    // which is a state the page can render rather than an error it should fail
    // on, so the whole call degrades to null. A blip degrades the same way: the
    // rest of the page is about live population and does not depend on this.
    unicum
      .region(region)
      .players.distribution()
      .then((d) => d as unknown as PlayerDistribution)
      .catch(() => null),
  ]);

  const label = REGION_LABEL[region];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {label}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks{" "}
            <span className="text-brand">{label} server population</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            How many players are on each {label} server right now, how that
            number moves through the day and the week, and how the region
            compares with the others.
          </p>
          <div className="mt-8">
            <ServersLiveHeader
              region={region}
              fallbackTotal={stats.current}
              fallbackClusters={stats.clusters}
              rhythm={stats.rhythm}
            />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ServersDashboard
        region={region}
        initialRange={DEFAULT_RANGE}
        initialStats={stats}
        initialComparison={comparison}
      />

      {distribution ? (
        <>
          <PanelSeparator />

          <DistributionPanel distribution={distribution} region={region} />

          <PanelSeparator />

          <Panel>
            <PanelHeader>
              <PanelTitle>Where {label} battles are fought</PanelTitle>
            </PanelHeader>
            {/* Like the distribution panel: the sections carry their own
                padding so their dividing rules reach the panel's borders. */}
            <PanelContent className="p-0">
              <BattleShares
                byTier={distribution.byTier}
                byType={distribution.byType}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      <PanelSeparator />

      <Panel>
        <PanelContent className="text-sm text-fd-muted-foreground">
          <p>
            Wargaming publishes each server&apos;s population as an instant and
            keeps no history of it, so every figure past the current minute is
            one we recorded ourselves, every{" "}
            {/* Kept in prose rather than a constant: the sentence is about what
                the reader is looking at, not about the sampler's configuration. */}
            five minutes.{" "}
            {stats.since
              ? `The series starts on ${formatMoment(stats.since)}, when the recording started, and nothing before it can be recovered.`
              : "Recording has just started, so the charts fill in from here."}
          </p>
          <p className="mt-2">
            Wargaming names a region&apos;s first clusters and leaves the rest
            as bare identifiers, so 203 is shown as EU3, continuing the
            region&apos;s own numbering. The identifier is what we record and
            what each name reveals on hover, and it is what the label follows:
            numbering the clusters by how busy they are would move a name from
            one server to another whenever two of them traded places. A server
            missing from a sample was not reported at all, which is not the same
            as empty.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
