import { numberFormat } from "@/lib/format";
import { dateLocale } from "@/lib/date-locale";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
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
  formatCadence,
} from "@unicum.gg/shared";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";
import { ChartMode } from "./chart-mode";
import { CoverageAreaChart } from "./coverage-charts-lazy";
import { CostBreakdown } from "./cost-breakdown";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT_FORMAT = {
  style: "percent",
  maximumFractionDigits: 0,
} as const;

function formatOnTime(onTime: number, total: number, locale: string): string {
  if (total === 0) return "n/a";
  return numberFormat(locale, PCT_FORMAT).format(onTime / total);
}

function formatYear(d: Date | null, locale: string): string {
  return d ? format(d, "MMMM yyyy", { locale: dateLocale(locale) }) : "n/a";
}

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${numberFormat(locale, DEC_FORMAT).format(value)} ${units[unitIndex]}`;
}

export async function CoverageView({ region, locale }: { region: Region; locale: string }) {
  const { t: tLabel } = await getTranslation("components/labels", locale);
  const { t: tr } = await getTranslation("components/coverage/coverage-view", locale);
  const stats = await unicum.region(region).coverage();

  // How many tracked players already have at least one snapshot, which is what
  // `firstSnapshotsDaily` accumulates to. The refresh-policy breakdown already
  // counts the never-fetched ones per bucket (`due_at = 'epoch'`), so this needs
  // no extra query, unlike `activity.awaitingFirstSnapshot`, which only covers
  // the Unfetched bucket.
  const playersWithSnapshot =
    stats.players -
    stats.refreshPolicy.reduce((sum, row) => sum + row.neverSnapped, 0);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            {/* One sentence with both figures as holes: "Tracking X players
                across Y clans" is not built in that order everywhere. */}
            <Interpolate
              template={tr("tracking")}
              values={{
                players: (
                  <span className="text-brand">
                    {numberFormat(locale, INT_FORMAT).format(stats.players)}
                  </span>
                ),
                clans: (
                  <span className="text-brand">{numberFormat(locale, INT_FORMAT).format(stats.clans)}</span>
                ),
              }}
            />
          </h1>
          <p className="mt-4 text-fd-muted-foreground">
            {tr("adaptive-cadence")}{" "}
            <a
              href={APP.EXTERNAL.GITHUB}
              className="underline-offset-2 hover:underline"
            >
              {tr("code-on-github")}</a>
            .
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("activity")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCell
              label={tr("last-player-snapshot")}
              value={
                stats.activity.lastPlayerSnapshotAt ? (
                  <RelativeTime date={stats.activity.lastPlayerSnapshotAt} />
                ) : (
                  "n/a"
                )
              }
            />
            <StatCell
              label={tr("last-clan-refresh")}
              value={
                stats.activity.lastClanRefreshAt ? (
                  <RelativeTime date={stats.activity.lastClanRefreshAt} />
                ) : (
                  "n/a"
                )
              }
            />
            <StatCell
              label={tr("player-snapshots-in-24h")}
              value={numberFormat(locale, INT_FORMAT).format(stats.activity.playerSnapshotsLast24h)}
            />
            <StatCell
              label={tr("clans-refreshed-in-24h")}
              value={numberFormat(locale, INT_FORMAT).format(stats.activity.clansRefreshedLast24h)}
            />
            <StatCell
              label={tr("players-on-time")}
              value={formatOnTime(
                stats.activity.snapshotFreshness.onTime,
                stats.activity.snapshotFreshness.fetched,
              locale,
            )}
            />
            <StatCell
              label={tr("awaiting-first-snapshot")}
              value={numberFormat(locale, INT_FORMAT).format(stats.activity.awaitingFirstSnapshot)}
            />
          </div>
          <p className="text-xs text-fd-muted-foreground">
            {tr("snapshot-cadence-adapts-to-each")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("refresh-policy")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border text-xs uppercase tracking-wide text-fd-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">{tr("bucket")}</th>
                <th className="px-4 py-2 text-right font-medium">{tr("players")}</th>
                <th className="px-4 py-2 text-right font-medium">
                  {tr("target-cadence")}</th>
                <th className="px-4 py-2 text-right font-medium">{tr("on-time")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.refreshPolicy.map((row) => (
                <tr
                  key={row.bucket}
                  className="border-b border-fd-border last:border-b-0"
                >
                  <td className="px-4 py-2">
                    {tLabel(`activity-buckets.${row.bucket}`)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {numberFormat(locale, INT_FORMAT).format(row.total)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                    {formatCadence(row.cadenceMs)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatOnTime(row.onTime, row.total, locale)}
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
          <PanelTitle>{tr("trends-last-30-days")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
          <CoverageAreaChart
            title={tr("new-players-discovered")}
            data={stats.trends.playersDiscoveredDaily}
            ariaLabel={tr("new-players-discovered-last-30-days")}
            defaultMode={ChartMode.Cumulative}
            total={stats.players}
          />
          <CoverageAreaChart
            title={tr("new-clans-discovered")}
            data={stats.trends.clansDiscoveredDaily}
            ariaLabel={tr("new-clans-discovered-last-30-days")}
            defaultMode={ChartMode.Cumulative}
            total={stats.clans}
          />
          <CoverageAreaChart
            title={tr("player-snapshots")}
            data={stats.trends.playerSnapshotsDaily}
            ariaLabel={tr("player-snapshots-last-30-days")}
            defaultMode={ChartMode.Daily}
            total={stats.playerSnapshots}
          />
          <CoverageAreaChart
            title={tr("first-time-snapshots")}
            data={stats.trends.firstSnapshotsDaily}
            ariaLabel={tr("first-ever-snapshots-per-day-last-30-days")}
            defaultMode={ChartMode.Daily}
            total={playersWithSnapshot}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("data-corpus")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
          <StatCell
            label={tr("player-snapshots")}
            value={numberFormat(locale, INT_FORMAT).format(stats.playerSnapshots)}
          />
          <StatCell
            label={tr("tank-snapshots")}
            value={numberFormat(locale, INT_FORMAT).format(stats.tankSnapshots)}
          />
          <StatCell
            label={tr("clan-member-rows")}
            value={numberFormat(locale, INT_FORMAT).format(stats.clanMembers)}
          />
          <StatCell
            label={tr("clan-events")}
            value={numberFormat(locale, INT_FORMAT).format(stats.clanRecentEvents)}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("refresh-queues")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="flex flex-col divide-y divide-fd-border p-0 md:flex-row md:divide-x md:divide-y-0">
          <QueueCell
            label={tr("snapshot-backlog")}
            value={numberFormat(locale, INT_FORMAT).format(stats.snapshotBacklog)}
            description={tr("players-past-their-adaptive-refresh")}
          />
          <QueueCell
            label={tr("clan-refresh-queue")}
            value={numberFormat(locale, INT_FORMAT).format(stats.clanRefreshQueue)}
            description={tr("on-demand-page-hits-enqueue")}
          />
          <QueueCell
            label={tr("player-refresh-queue")}
            value={numberFormat(locale, INT_FORMAT).format(stats.playerRefreshQueue)}
            description={tr("on-demand-page-hits-enqueue-2")}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("infrastructure")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-6 p-4">
          <CostBreakdown costs={stats.infrastructure.costs} />
          <StatCell
            label={tr("database-size")}
            value={formatBytes(stats.infrastructure.databaseBytes, locale)}
          />
          {stats.infrastructure.tables.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
                {tr("top-tables")}</div>
              <ul className="divide-y divide-fd-border text-sm">
                {stats.infrastructure.tables.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="font-mono text-fd-muted-foreground">
                      {t.name}
                    </span>
                    <span className="tabular-nums">{formatBytes(t.bytes, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-fd-muted-foreground">
            {tr("open-source-community-funded-numbers")}</p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tr("fun-facts")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCell
            label={tr("tracking-since")}
            value={formatYear(stats.funFacts.oldestPlayerSnapshotAt, locale)}
          />
          <StatCell
            label={tr("biggest-tracked-clan")}
            value={
              stats.funFacts.biggestClan ? (
                <span>
                  [{stats.funFacts.biggestClan.tag}] ·{" "}
                  {tr("n-members", {
                    count: numberFormat(locale, INT_FORMAT).format(
                      stats.funFacts.biggestClan.membersCount,
                    ),
                  })}
                </span>
              ) : (
                "n/a"
              )
            }
          />
          <StatCell
            label={tr("battles-tracked")}
            value={numberFormat(locale, INT_FORMAT).format(stats.funFacts.totalBattlesTracked)}
          />
          <StatCell
            label={tr("discord-servers")}
            value={
              stats.funFacts.discordServers === null
                ? "n/a"
                : numberFormat(locale, INT_FORMAT).format(stats.funFacts.discordServers)
            }
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
