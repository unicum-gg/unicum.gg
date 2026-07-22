"use client";

import { format } from "date-fns";
import Image from "next/image";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { AutoFitText } from "@/components/auto-fit-text";
import { ClanActionsMenu } from "@/components/clans/detail/actions-menu";
import { CompareWithButton } from "@/components/clans/detail/compare-with-button";
import { LanguageFlags } from "@/components/language-flags";
import { RelativeTime } from "@/components/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type BeaconState,
  RefreshIndicator,
  RefreshKind,
  useRefreshBeacon,
} from "@/components/refresh-beacon";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { ClanFullInfo } from "@unicum.gg/core/wargaming/wot/clans/info";
import { ClanRole } from "@unicum.gg/wargaming";
import {
  type ClanMemberStats,
  type ClanRatings,
} from "@unicum.gg/shared";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
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

function computeMetrics(r: ClanRatings): {
  recent: MetricSet;
  lifetime: MetricSet;
  avgWinrate: MetricCell;
} {
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

export function ClanHeader(
  props:
    | { loading: true; region: Region; tag: string; color: string }
    | {
        region: Region;
        clan: ClanFullInfo;
        members: ClanMemberStats[];
        ratings: ClanRatings;
      },
) {
  const loading = "loading" in props;
  // Run the beacon once here (the header renders its meta line twice, for the
  // desktop and mobile layouts); both InfoRows render the indicator from this
  // shared state so we don't fire duplicate enqueues. Called unconditionally
  // (rules of hooks); a null `updatedAt` while loading is a no-op.
  const beacon = useRefreshBeacon(
    RefreshKind.Clan,
    props.region,
    loading ? props.tag : props.clan.tag,
    loading ? null : props.clan.updatedAt,
  );

  if (loading) {
    return <ClanHeaderSkeleton tag={props.tag} color={props.color} />;
  }

  const { region, clan, members, ratings } = props;
  const metrics = computeMetrics(ratings);
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
            beacon={beacon}
            className="hidden h-8 sm:flex"
            flagWrapperClassName="h-full"
          />
        </div>
      </div>
      <InfoRow
        region={region}
        clan={clan}
        members={members}
        beacon={beacon}
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
  beacon,
  className,
  flagWrapperClassName,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  beacon: BeaconState;
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
        {clan.updatedAt && (
          <>
            <span className="hidden sm:inline">·</span>
            <span>
              <span className="font-medium">Updated</span>{" "}
              <RelativeTime
                date={clan.updatedAt}
                title={format(clan.updatedAt, "MMM d, yyyy 'at' h:mm:ss a")}
              />
            </span>
          </>
        )}
        <RefreshIndicator {...beacon} />
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

/** The loading twin: real [tag] + the same emblem / meta / 7 metric columns as
 * placeholders. The size-24 emblem and the h1 row set the header height, so it
 * matches the loaded header. */
function ClanHeaderSkeleton({ tag, color }: { tag: string; color: string }) {
  // The seven metric columns, tagged for the rating-column toggle like the real
  // ones (recent wn7/8/x, lifetime wn7/8/x, avg winrate).
  const ratingCols = ["wn7", "wn8", "wnx", "wn7", "wn8", "wnx", undefined];
  const metaRow = (className: string) => (
    <div className={cn("border-t border-fd-border", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-1 text-xs sm:py-0">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex items-stretch sm:contents">
        <div className="flex size-24 shrink-0 items-center justify-center border-r border-fd-border p-3">
          <Skeleton className="size-full rounded-md" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-2 sm:h-16 sm:flex-none sm:py-0">
            <h1 className="flex min-w-0 flex-1 items-center font-heading text-2xl font-bold tracking-tight sm:text-4xl">
              <span className="shrink-0">
                <span style={{ color }}>[</span>
                {tag}
                <span style={{ color }}>]</span>
              </span>
              {/* The clan name isn't known before the fetch — placeholder next
                  to the real [tag], like the loaded `[TAG] Name`. */}
              <Skeleton className="ml-2 h-6 w-48 max-w-full sm:h-8" />
            </h1>
            {/* The compare + actions triggers are 28px square icon buttons. */}
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
          {metaRow("hidden h-8 sm:flex")}
        </div>
      </div>
      {metaRow("flex min-h-8 sm:hidden")}
      <div className="flex border-t border-fd-border sm:contents sm:border-t-0">
        {ratingCols.map((c, i) => (
          <div
            key={i}
            data-rating-col={c}
            className="flex flex-1 flex-col border-l border-fd-border max-sm:first:border-l-0 sm:w-32 sm:flex-none sm:shrink-0"
          >
            <div className="flex justify-center px-4 py-2">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex flex-1 items-center justify-center border-t border-fd-border">
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
