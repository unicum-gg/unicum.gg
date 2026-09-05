import {
  VehicleRow,
  VehicleRowSkeleton,
} from "@/components/tanks/vehicle-row";
import { RatingMetric, type LiftDrag, type LiftDragRow, RATING_COLOR_CLASS, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

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
export function TanksLiftDrag(
  props:
    | { loading: true; metricLabel: string }
    | {
        region: Region;
        liftDrag: LiftDrag | null;
        metric: RatingMetric;
        metricLabel: string;
      },
): React.ReactElement | null {
  if ("loading" in props) {
    return (
      <div className="grid gap-px bg-fd-border md:grid-cols-2">
        <ColumnSkeleton kind="lift" metricLabel={props.metricLabel} />
        <ColumnSkeleton kind="drag" metricLabel={props.metricLabel} />
      </div>
    );
  }

  const { region, liftDrag, metric, metricLabel } = props;
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

// The loading twin of `Column`: same header (static text + the real metricLabel)
// and the same row line-boxes, only the values are placeholders.
function ColumnSkeleton({
  kind,
  metricLabel,
}: {
  kind: "lift" | "drag";
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
          <span className="text-xs text-fd-muted-foreground">{metricLabel}</span>
        </div>
        <p className="mt-0.5 text-xs text-fd-muted-foreground">
          {isLift
            ? "Tanks that prop the overall up: dropping them would lower the rating."
            : "Tanks that weigh the overall down: dropping them would raise the rating."}
        </p>
      </div>
      <ul>
        {Array.from({ length: 5 }, (_, i) => (
          <VehicleRowSkeleton key={i} />
        ))}
      </ul>
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
  const sign = isPositive ? "+" : "\u2212";
  return (
    <VehicleRow
      region={region}
      tag={row.tag}
      type={row.type}
      tier={row.tier}
      isPremium={row.isPremium}
      name={row.name}
      battles={row.battles}
      badge={
        <span
          className={cn(
            "px-2 py-0.5 text-xs",
            ratingColorClass(metric, row.rating),
          )}
        >
          {decFmt.format(row.rating)}
        </span>
      }
      caption={
        <span className="text-xs font-medium text-fd-muted-foreground">
          {sign}
          {decFmt.format(Math.abs(row.removalDelta))} if removed
        </span>
      }
    />
  );
}
