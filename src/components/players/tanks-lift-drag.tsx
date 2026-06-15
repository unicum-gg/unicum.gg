import { toRoman } from "roman-numerals";
import { TankIcon } from "@/components/players/tank-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { RatingMetric } from "@/constants/rating";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";
import { type VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  type WN8Expected,
  wnxColor,
  type WNXExpected,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

// Below this you can't tell if a player is actually that good on the
// tank or just got lucky on a few games. Same threshold as the period
// leaderboards' min battles for the 24h window.
const MIN_BATTLES = 30;
const TOP_N = 5;

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Scored = {
  tank: TankStats;
  meta: VehicleMeta;
  rating: number;
  battles: number;
  delta: number; // rating - overall (positive = lift, negative = drag)
  leverage: number; // |delta| * battles, used to rank within each side
};

function computeRating(
  tank: TankStats,
  meta: VehicleMeta | null,
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  const battles = tank.all.battles;
  if (battles <= 0) return null;
  if (metric === RatingMetric.Wn7) {
    return computeWN7(
      {
        battles,
        wins: tank.all.wins,
        frags: tank.all.frags,
        damageDealt: tank.all.damage_dealt,
        spotted: tank.all.spotted,
        droppedCapturePoints: tank.all.dropped_capture_points,
      },
      meta?.tier ?? null,
    );
  }
  if (metric === RatingMetric.Wn8) {
    return computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback);
  }
  return computeWNX([tank], wnxExpected);
}

function ratingColorClass(metric: RatingMetric, value: number): string {
  if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
  if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
  return RATING_COLOR_CLASS[wnxColor(value)];
}

export function TanksLiftDrag({
  region,
  tanks,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  metric,
  metricLabel,
  overallRating,
}: {
  region: Region;
  tanks: TankStats[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  metric: RatingMetric;
  metricLabel: string;
  overallRating: number | null;
}): React.ReactElement | null {
  if (overallRating === null) return null;
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const scored: Scored[] = [];
  for (const tank of tanks) {
    const battles = tank.all.battles;
    if (battles < MIN_BATTLES) continue;
    const meta = encyclopedia[String(tank.tank_id)] ?? null;
    if (!meta) continue;
    const rating = computeRating(
      tank,
      meta,
      metric,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      encyclopedia,
    );
    if (rating === null || !Number.isFinite(rating)) continue;
    const delta = rating - overallRating;
    scored.push({
      tank,
      meta,
      rating,
      battles,
      delta,
      leverage: Math.abs(delta) * battles,
    });
  }
  if (scored.length === 0) return null;

  const lift = scored
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, TOP_N);
  const drag = scored
    .filter((s) => s.delta < 0)
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, TOP_N);

  if (lift.length === 0 && drag.length === 0) return null;

  return (
    <div className="grid gap-px bg-fd-border md:grid-cols-2">
      <Column
        region={region}
        rows={lift}
        kind="lift"
        metric={metric}
        metricLabel={metricLabel}
      />
      <Column
        region={region}
        rows={drag}
        kind="drag"
        metric={metric}
        metricLabel={metricLabel}
      />
    </div>
  );
}

function Column({
  region,
  rows,
  kind,
  metric,
  metricLabel,
}: {
  region: Region;
  rows: Scored[];
  kind: "lift" | "drag";
  metric: RatingMetric;
  metricLabel: string;
}) {
  const isLift = kind === "lift";
  return (
    <div className="bg-fd-card">
      <div className="border-b border-fd-border px-4 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            {isLift ? "🚀 Lifting the rating" : "⚓ Dragging the rating"}
          </span>
          <span className="text-xs text-fd-muted-foreground">
            {metricLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-fd-muted-foreground">
          {isLift
            ? "Tanks scoring above the overall rating. More battles on these pulls the average up."
            : "Tanks scoring below the overall rating. Fewer battles (or better play) on these pulls the average up."}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
          {isLift
            ? "No tank above the overall rating yet."
            : "No tank below the overall rating — clean run."}
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row
              key={row.tank.tank_id}
              region={region}
              row={row}
              kind={kind}
              metric={metric}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  region,
  row,
  kind,
  metric,
}: {
  region: Region;
  row: Scored;
  kind: "lift" | "drag";
  metric: RatingMetric;
}) {
  const isLift = kind === "lift";
  const deltaSign = isLift ? "+" : "−";
  return (
    <li className="flex items-center gap-3 border-b border-fd-border/40 px-4 py-2">
      <span className="flex w-10 shrink-0 items-center justify-center">
        <TankIcon
          region={region}
          tag={row.meta.tag}
          type={row.meta.type}
          className="h-3 w-auto object-contain"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.meta.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <span>Tier {toRoman(row.meta.tier)}</span>
          <VehicleTypeIcon
            type={row.meta.type}
            premium={row.meta.isPremium}
            className="size-3.5"
          />
          <span>· {intFmt.format(row.battles)} battles</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 tabular-nums">
        <span
          className={cn(
            "px-2 py-0.5 text-xs",
            ratingColorClass(metric, row.rating),
          )}
        >
          {decFmt.format(row.rating)}
        </span>
        <span
          className={cn(
            "text-xs font-medium",
            isLift ? "text-green-500" : "text-red-500",
          )}
        >
          {deltaSign}
          {decFmt.format(Math.abs(row.delta))}
        </span>
      </div>
    </li>
  );
}
