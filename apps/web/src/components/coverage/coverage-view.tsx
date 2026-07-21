import { format } from "date-fns";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RelativeTime } from "@/components/relative-time";
import APP from "@/constants/app";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import {
  ACTIVITY_BUCKET_LABEL,
  formatCadence,
} from "@unicum.gg/shared";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";
import { ChartMode, CoverageAreaChart } from "./coverage-charts";
import { CostBreakdown } from "./cost-breakdown";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

function formatOnTime(onTime: number, total: number): string {
  if (total === 0) return "n/a";
  return pctFmt.format(onTime / total);
}

function formatYear(d: Date | null): string {
  return d ? format(d, "MMMM yyyy") : "n/a";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${decFmt.format(value)} ${units[unitIndex]}`;
}

export async function CoverageView({ region }: { region: Region }) {
  const stats = await unicum.region(region).coverage();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Tracking{" "}
            <span className="text-[#f25322]">
              {intFmt.format(stats.players)}
            </span>{" "}
            players across{" "}
            <span className="text-[#f25322]">{intFmt.format(stats.clans)}</span>{" "}
            clans
          </h1>
          <p className="mt-4 text-fd-muted-foreground">
            Refreshed on an adaptive cadence: active players every few hours,
            dormants every weeks. Open source, no ads.{" "}
            <a
              href={APP.EXTERNAL.GITHUB}
              className="underline-offset-2 hover:underline"
            >
              Code on GitHub
            </a>
            .
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Activity</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCell
              label="Last player snapshot"
              value={
                stats.activity.lastPlayerSnapshotAt ? (
                  <RelativeTime date={stats.activity.lastPlayerSnapshotAt} />
                ) : (
                  "n/a"
                )
              }
            />
            <StatCell
              label="Last clan refresh"
              value={
                stats.activity.lastClanRefreshAt ? (
                  <RelativeTime date={stats.activity.lastClanRefreshAt} />
                ) : (
                  "n/a"
                )
              }
            />
            <StatCell
              label="Player snapshots in 24h"
              value={intFmt.format(stats.activity.playerSnapshotsLast24h)}
            />
            <StatCell
              label="Clans refreshed in 24h"
              value={intFmt.format(stats.activity.clansRefreshedLast24h)}
            />
            <StatCell
              label="Players on-time"
              value={formatOnTime(
                stats.activity.snapshotFreshness.onTime,
                stats.activity.snapshotFreshness.fetched,
              )}
            />
            <StatCell
              label="Awaiting first snapshot"
              value={intFmt.format(stats.activity.awaitingFirstSnapshot)}
            />
          </div>
          <p className="text-xs text-fd-muted-foreground">
            Snapshot cadence adapts to each player based on their last-battle
            recency. Active players (last 24h) refresh every 6h, dormants on
            longer windows up to 90 days. On-time counts players we re-checked
            within their target bucket cadence. The breakdown below shows the
            policy in detail.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Refresh policy</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border text-xs uppercase tracking-wide text-fd-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Bucket</th>
                <th className="px-4 py-2 text-right font-medium">Players</th>
                <th className="px-4 py-2 text-right font-medium">
                  Target cadence
                </th>
                <th className="px-4 py-2 text-right font-medium">On-time</th>
              </tr>
            </thead>
            <tbody>
              {stats.refreshPolicy.map((row) => (
                <tr
                  key={row.bucket}
                  className="border-b border-fd-border last:border-b-0"
                >
                  <td className="px-4 py-2">
                    {ACTIVITY_BUCKET_LABEL[row.bucket]}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {intFmt.format(row.total)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                    {formatCadence(row.cadenceMs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatOnTime(row.onTime, row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Trends, last 30 days</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
          <CoverageAreaChart
            title="New players discovered"
            data={stats.trends.playersDiscoveredDaily}
            ariaLabel="New players discovered, last 30 days"
            defaultMode={ChartMode.Cumulative}
          />
          <CoverageAreaChart
            title="New clans discovered"
            data={stats.trends.clansDiscoveredDaily}
            ariaLabel="New clans discovered, last 30 days"
            defaultMode={ChartMode.Cumulative}
          />
          <CoverageAreaChart
            title="Player snapshots"
            data={stats.trends.playerSnapshotsDaily}
            ariaLabel="Player snapshots, last 30 days"
            defaultMode={ChartMode.Daily}
          />
          <CoverageAreaChart
            title="First-time snapshots"
            data={stats.trends.firstSnapshotsDaily}
            ariaLabel="First-ever snapshots per day, last 30 days"
            defaultMode={ChartMode.Daily}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Data corpus</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
          <StatCell
            label="Player snapshots"
            value={intFmt.format(stats.playerSnapshots)}
          />
          <StatCell
            label="Tank snapshots"
            value={intFmt.format(stats.tankSnapshots)}
          />
          <StatCell
            label="Clan member rows"
            value={intFmt.format(stats.clanMembers)}
          />
          <StatCell
            label="Clan events"
            value={intFmt.format(stats.clanRecentEvents)}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Refresh queues</PanelTitle>
        </PanelHeader>
        <PanelContent className="flex flex-col divide-y divide-fd-border p-0 md:flex-row md:divide-x md:divide-y-0">
          <QueueCell
            label="Snapshot backlog"
            value={intFmt.format(stats.snapshotBacklog)}
            description="Players past their adaptive refresh target plus those awaiting first snapshot. The cron drains continuously, unfetched players first."
          />
          <QueueCell
            label="Clan refresh queue"
            value={intFmt.format(stats.clanRefreshQueue)}
            description="On-demand: page hits enqueue at priority 10, discovery feeds priority 0. Drained every 10s."
          />
          <QueueCell
            label="Player refresh queue"
            value={intFmt.format(stats.playerRefreshQueue)}
            description="On-demand: page hits enqueue at priority 10 when the cached snapshot is older than 5 min. Drained every 10s."
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Infrastructure</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-6 p-4">
          <CostBreakdown costs={stats.infrastructure.costs} />
          <StatCell
            label="Database size"
            value={formatBytes(stats.infrastructure.databaseBytes)}
          />
          {stats.infrastructure.tables.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
                Top tables
              </div>
              <ul className="divide-y divide-fd-border text-sm">
                {stats.infrastructure.tables.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="font-mono text-fd-muted-foreground">
                      {t.name}
                    </span>
                    <span className="tabular-nums">{formatBytes(t.bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-fd-muted-foreground">
            Open source, community-funded. Numbers above are global (shared
            across all regions).
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Fun facts</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
          <StatCell
            label="Tracking since"
            value={formatYear(stats.funFacts.oldestPlayerSnapshotAt)}
          />
          <StatCell
            label="Biggest tracked clan"
            value={
              stats.funFacts.biggestClan ? (
                <span>
                  [{stats.funFacts.biggestClan.tag}] ·{" "}
                  {intFmt.format(stats.funFacts.biggestClan.membersCount)}{" "}
                  members
                </span>
              ) : (
                "n/a"
              )
            }
          />
          <StatCell
            label="Battles tracked"
            value={intFmt.format(stats.funFacts.totalBattlesTracked)}
          />
        </PanelContent>
      </Panel>
    </div>
  );
}

function StatCell({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QueueCell({
  label,
  value,
  description,
}: {
  label: string;
  value: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <p className="text-xs text-fd-muted-foreground">{description}</p>
    </div>
  );
}
