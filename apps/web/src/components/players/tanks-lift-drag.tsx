import { toRoman } from "roman-numerals";
import { TankIcon } from "@/components/players/tank-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { RatingMetric } from "@unicum.gg/core/constants/rating";
import { cn } from "@/lib/utils";
import type { LiftDrag, LiftDragRow } from "@unicum.gg/core/players/lift-drag";
import type { Region } from "@unicum.gg/wargaming/region";
import {
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/core/wargaming/wot/ratings";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ratingColorClass(metric: RatingMetric, value: number): string {
  if (metric === RatingMetric.Wn7) return RATING_COLOR_CLASS[wn7Color(value)];
  if (metric === RatingMetric.Wn8) return RATING_COLOR_CLASS[wn8Color(value)];
  return RATING_COLOR_CLASS[wnxColor(value)];
}

// Rows arrive pre-computed from the server (see services/players/lift-drag);
// this component only renders them.
export function TanksLiftDrag({
  region,
  liftDrag,
  metric,
  metricLabel,
}: {
  region: Region;
  liftDrag: LiftDrag | null;
  metric: RatingMetric;
  metricLabel: string;
}): React.ReactElement | null {
  if (!liftDrag) return null;

  return (
    <div className="grid gap-px bg-fd-border md:grid-cols-2">
      <Column
        region={region}
        rows={liftDrag.lift}
        kind="lift"
        metric={metric}
        metricLabel={metricLabel}
      />
      <Column
        region={region}
        rows={liftDrag.drag}
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
  rows: LiftDragRow[];
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
            ? "Tanks that prop the overall up: dropping them would lower the rating."
            : "Tanks that weigh the overall down: dropping them would raise the rating."}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
          {isLift ? "No tank propping up the overall." : "No tank dragging the overall down."}
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row key={row.tankId} region={region} row={row} metric={metric} />
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
  row: LiftDragRow;
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
          tag={row.tag}
          type={row.type}
          className="h-3 w-auto object-contain"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <span>Tier {toRoman(row.tier)}</span>
          <VehicleTypeIcon
            type={row.type}
            premium={row.isPremium}
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
