import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RelativeTime } from "@/components/relative-time";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { getCoverageStats } from "@/services/coverage";
import { Region, REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";
import { CoverageAreaChart } from "./coverage-charts";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatYear(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "n/a";
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
  const stats = await getCoverageStats(region);

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
            Refreshed every 24h by our snapshot system. Open source, no login,
            no ads.{" "}
            <a
              href={ROUTES.EXTERNAL.GITHUB}
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
          <PanelTitle>Activity, last 24 hours</PanelTitle>
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
          </div>
          <p className="text-xs text-fd-muted-foreground">
            The snapshot cron refreshes up to 200 players per region per minute
            to stay under Wargaming's API rate limits. Backlogs drain
            continuously and every player is eventually refreshed.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Trends, last 30 days</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              New players discovered per day
            </div>
            <CoverageAreaChart
              data={stats.trends.playersDiscoveredDaily}
              ariaLabel="New players discovered per day, last 30 days"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              Player snapshots per day
            </div>
            <CoverageAreaChart
              data={stats.trends.playerSnapshotsDaily}
              ariaLabel="Player snapshots per day, last 30 days"
            />
          </div>
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
            description="Players whose last snapshot is older than 24h. Snapshot-cron drains at 200 per region per minute."
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
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              Estimated annual cost
            </div>
            <div className="font-heading text-4xl font-bold tabular-nums text-[#f25322]">
              {usdFmt.format(stats.infrastructure.costs.totalAnnualUsd)}
            </div>
            <div className="text-sm text-fd-muted-foreground">
              Fixed monthly bill, no surprises. Hosted on an OVH VPS, no
              third-party SaaS in the data path. Will only grow if we outgrow
              the current server.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCell
              label="Database size"
              value={formatBytes(stats.infrastructure.databaseBytes)}
            />
            <StatCell
              label="Monthly run rate"
              value={usdFmt.format(stats.infrastructure.costs.totalAnnualUsd / 12)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              Cost breakdown
            </div>
            <ul className="divide-y divide-fd-border text-sm">
              {stats.infrastructure.costs.breakdown.map((line) => (
                <li
                  key={line.label}
                  className="flex items-start justify-between gap-4 py-2"
                >
                  <span>
                    <span className="text-fd-foreground">{line.label}</span>
                    {line.note && (
                      <span className="block text-xs text-fd-muted-foreground">
                        {line.note}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {line.usdAnnual > 0 ? usdFmt.format(line.usdAnnual) : "free"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
