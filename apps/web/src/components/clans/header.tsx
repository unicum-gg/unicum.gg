import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { AutoFitText } from "@/components/auto-fit-text";
import { ClanActionsMenu } from "@/components/clans/clan-actions-menu";
import { CompareWithButton } from "@/components/clans/compare-with-button";
import { LanguageFlags } from "@/components/language-flags";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import {
  type ClanMemberStats,
  ClanRole,
  computeClanRatings,
} from "@unicum.gg/core/clans/members";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/core/wargaming/wot/ratings";
import { type Region } from "@unicum.gg/wargaming";

const DAY_FORMAT = "MMM d, yyyy";
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type MetricCell = {
  label: string;
  value: string;
  color: RatingColor | null;
};

type MetricSet = {
  wn7: MetricCell;
  wn8: MetricCell;
  wnx: MetricCell;
};

function metricCell(
  label: string,
  value: number | null,
  color: (v: number) => RatingColor,
): MetricCell {
  return {
    label,
    value: value === null ? "—" : intFmt.format(value),
    color: value === null ? null : color(value),
  };
}

function computeMetrics(members: ClanMemberStats[]): {
  recent: MetricSet;
  lifetime: MetricSet;
  avgWinrate: MetricCell;
} {
  const r = computeClanRatings(members);
  return {
    recent: {
      wn7: metricCell("Avg WN7 · 30d", r.recent.wn7, wn7Color),
      wn8: metricCell("Avg WN8 · 30d", r.recent.wn8, wn8Color),
      wnx: metricCell("Avg WNX · 30d", r.recent.wnx, wnxColor),
    },
    lifetime: {
      wn7: metricCell("Avg WN7", r.lifetime.wn7, wn7Color),
      wn8: metricCell("Avg WN8", r.lifetime.wn8, wn8Color),
      wnx: metricCell("Avg WNX", r.lifetime.wnx, wnxColor),
    },
    avgWinrate: {
      label: "Avg winrate",
      value: r.avgWinrate === null ? "—" : `${pctFmt.format(r.avgWinrate)}%`,
      color: r.avgWinrate === null ? null : winrateColor(r.avgWinrate / 100),
    },
  };
}

export function ClanHeader({
  region,
  clan,
  members,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
}) {
  const metrics = computeMetrics(members);
  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex items-stretch sm:contents">
        {clan.emblem && (
          <div className="flex size-24 shrink-0 items-center justify-center border-r border-fd-border p-3">
            <Image
              src={clan.emblem}
              alt={`${clan.tag} emblem`}
              width={195}
              height={195}
              className="size-full object-contain"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-2 sm:h-16 sm:flex-none sm:py-0">
            <h1 className="min-w-0 flex-1 font-heading font-bold tracking-tight">
              <AutoFitText maxPx={36} minPx={18} allowWrap className="w-full">
                <span style={{ color: clan.color }}>[</span>
                {clan.tag}
                <span style={{ color: clan.color }}>]</span>
                <span className="ml-2">{clan.name}</span>
              </AutoFitText>
            </h1>
            <CompareWithButton region={region} current={clan.tag} />
            <ClanActionsMenu
              region={region}
              clan={{
                id: clan.id,
                tag: clan.tag,
                name: clan.name,
                color: clan.color,
                membersCount: clan.membersCount,
                emblem: clan.emblem,
              }}
            />
          </div>
          <InfoRow
            region={region}
            clan={clan}
            members={members}
            className="hidden h-8 sm:flex"
            flagWrapperClassName="h-full"
          />
        </div>
      </div>
      <InfoRow
        region={region}
        clan={clan}
        members={members}
        className="flex min-h-8 sm:hidden"
        flagWrapperClassName="h-6 self-end"
      />
      <div className="flex border-t border-fd-border sm:contents sm:border-t-0">
        <MetricColumn metric={metrics.recent.wn7} ratingCol="wn7" />
        <MetricColumn metric={metrics.recent.wn8} ratingCol="wn8" />
        <MetricColumn metric={metrics.recent.wnx} ratingCol="wnx" />
        <MetricColumn metric={metrics.lifetime.wn7} ratingCol="wn7" />
        <MetricColumn metric={metrics.lifetime.wn8} ratingCol="wn8" />
        <MetricColumn metric={metrics.lifetime.wnx} ratingCol="wnx" />
        <MetricColumn metric={metrics.avgWinrate} />
      </div>
    </header>
  );
}

function MetricColumn({
  metric,
  ratingCol,
}: {
  metric: MetricCell;
  ratingCol?: string;
}) {
  return (
    <div
      data-rating-col={ratingCol}
      className="flex flex-1 flex-col border-l border-fd-border max-sm:first:border-l-0 sm:w-32 sm:flex-none sm:shrink-0"
    >
      <div className="px-4 py-2 text-center text-xs text-muted-foreground">
        {metric.label}
      </div>
      <div
        className={cn(
          "flex flex-1 items-center justify-center border-t border-fd-border text-xl font-semibold tabular-nums",
          metric.color && RATING_COLOR_CLASS[metric.color],
        )}
      >
        {metric.value}
      </div>
    </div>
  );
}

function InfoRow({
  region,
  clan,
  members,
  className,
  flagWrapperClassName,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  className?: string;
  flagWrapperClassName?: string;
}) {
  const commanderName =
    members.find((m) => m.role === ClanRole.Commander)?.name ?? clan.leaderName;
  return (
    <div className={cn("border-t border-fd-border", className)}>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-y-0.5 px-4 py-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:py-0">
        <span>
          <span className="font-medium">Members:</span> {clan.membersCount}
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          <span className="font-medium">Created:</span>{" "}
          {format(clan.createdAt, DAY_FORMAT)} by{" "}
          <Link
            href={ROUTES.PLAYER(region, clan.creatorName)}
            className="underline-offset-2 hover:underline"
          >
            {clan.creatorName}
          </Link>
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          <span className="font-medium">Commander:</span>{" "}
          <Link
            href={ROUTES.PLAYER(region, commanderName)}
            className="underline-offset-2 hover:underline"
          >
            {commanderName}
          </Link>
        </span>
        {clan.isDisbanded && (
          <>
            <span className="hidden sm:inline">·</span>
            <span className="font-medium text-destructive">Disbanded</span>
          </>
        )}
      </div>
      {clan.languages.length > 0 && (
        <div className={cn("flex shrink-0 items-center", flagWrapperClassName)}>
          <LanguageFlags
            languages={clan.languages}
            size="l"
            source="declared"
            region={region}
          />
        </div>
      )}
    </div>
  );
}
