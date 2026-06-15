import { toRoman } from "roman-numerals";
import { TankIcon } from "@/components/players/tank-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { RatingMetric } from "@/constants/rating";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";
import {
  computeAvgTier,
  type VehicleMeta,
} from "@/services/wargaming/wot/encyclopedia";
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
  // overall_without_this_tank - overall_with_this_tank.
  // Positive => removing the tank lifts the overall (drag candidate).
  // Negative => removing the tank drops the overall (lift candidate).
  removalDelta: number;
};

function computePerTankRating(
  tank: TankStats,
  meta: VehicleMeta,
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
      meta.tier ?? null,
    );
  }
  if (metric === RatingMetric.Wn8) {
    return computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback);
  }
  return computeWNX([tank], wnxExpected);
}

function computeAggregateRating(
  tanks: TankStats[],
  metric: RatingMetric,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  if (tanks.length === 0) return null;
  if (metric === RatingMetric.Wn8) {
    return computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback);
  }
  if (metric === RatingMetric.Wnx) {
    return computeWNX(tanks, wnxExpected);
  }
  let battles = 0;
  let wins = 0;
  let frags = 0;
  let damage = 0;
  let spotted = 0;
  let droppedCap = 0;
  for (const tank of tanks) {
    const b = tank.all.battles;
    if (b <= 0) continue;
    battles += b;
    wins += tank.all.wins;
    frags += tank.all.frags;
    damage += tank.all.damage_dealt;
    spotted += tank.all.spotted;
    droppedCap += tank.all.dropped_capture_points;
  }
  if (battles === 0) return null;
  const avgTier = computeAvgTier(tanks, encyclopedia);
  return computeWN7(
    {
      battles,
      wins,
      frags,
      damageDealt: damage,
      spotted,
      droppedCapturePoints: droppedCap,
    },
    avgTier,
  );
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
}: {
  region: Region;
  tanks: TankStats[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  metric: RatingMetric;
  metricLabel: string;
}): React.ReactElement | null {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const overall = computeAggregateRating(
    tanks,
    metric,
    wn8Expected,
    wnxExpected,
    wn8Fallback,
    encyclopedia,
  );
  if (overall === null) return null;

  // Pre-index by tank_id so we can build "tanks without X" without
  // rescanning the array each time.
  const candidates: Array<{ tank: TankStats; meta: VehicleMeta; rating: number }> = [];
  for (const tank of tanks) {
    if (tank.all.battles < MIN_BATTLES) continue;
    const meta = encyclopedia[String(tank.tank_id)] ?? null;
    if (!meta) continue;
    const rating = computePerTankRating(
      tank,
      meta,
      metric,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      encyclopedia,
    );
    if (rating === null || !Number.isFinite(rating)) continue;
    candidates.push({ tank, meta, rating });
  }

  const scored: Scored[] = [];
  for (const c of candidates) {
    const tanksWithout = tanks.filter((t) => t.tank_id !== c.tank.tank_id);
    const overallWithout = computeAggregateRating(
      tanksWithout,
      metric,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      encyclopedia,
    );
    if (overallWithout === null) continue;
    const removalDelta = overallWithout - overall;
    if (!Number.isFinite(removalDelta) || removalDelta === 0) continue;
    scored.push({
      tank: c.tank,
      meta: c.meta,
      rating: c.rating,
      battles: c.tank.all.battles,
      removalDelta,
    });
  }
  if (scored.length === 0) return null;

  // Negative removalDelta = removing it lowers your overall → it's lifting you.
  // Positive removalDelta = removing it raises your overall → it's dragging you.
  const lift = scored
    .filter((s) => s.removalDelta < 0)
    .sort((a, b) => a.removalDelta - b.removalDelta) // most negative first
    .slice(0, TOP_N);
  const drag = scored
    .filter((s) => s.removalDelta > 0)
    .sort((a, b) => b.removalDelta - a.removalDelta) // most positive first
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
            ? "Tanks that prop the overall up — dropping them would lower the rating."
            : "Tanks that weigh the overall down — dropping them would raise the rating."}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
          {isLift ? "No tank propping up the overall." : "No tank dragging the overall down."}
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row
              key={row.tank.tank_id}
              region={region}
              row={row}
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
  metric,
}: {
  region: Region;
  row: Scored;
  metric: RatingMetric;
}) {
  // Display the signed change to the overall rating that would happen if
  // this tank were excluded. Positive (green) = removing helps you;
  // negative (red) = removing costs you.
  const isPositive = row.removalDelta > 0;
  const sign = isPositive ? "+" : "−";
  return (
    <li className="flex items-center gap-3 border-b border-fd-border/40 px-4 py-2 last:border-fd-border">
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
        <span className="text-xs font-medium text-fd-muted-foreground">
          {sign}
          {decFmt.format(Math.abs(row.removalDelta))} if removed
        </span>
      </div>
    </li>
  );
}
