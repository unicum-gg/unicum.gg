"use client";

import { useState, type MouseEvent } from "react";

const HHMM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const pct = (min: number) => (Math.max(0, Math.min(1440, min)) / 1440) * 100;

/**
 * A one-day forecast of when a workflow fires. Reserves last `blockMin` minutes
 * (~2h), so a window longer than one block chains several back-to-back
 * activations (18:00-22:00 with 2h boosts = fire at 18:00 and 20:00). Shows the
 * eligible window as a light band and each activation as a solid block on a 24h
 * bar, plus the exact fire times.
 */
export function BoostSchedulePreview({
  windowStart,
  windowEnd,
  blockMin,
  reserves,
}: {
  windowStart: number;
  windowEnd: number;
  blockMin: number;
  reserves: { type: string; name: string; percent: number | null }[];
}) {
  const blocks: { start: number; end: number }[] = [];
  if (blockMin > 0) {
    for (let t = windowStart; t < windowEnd; t += blockMin) {
      blocks.push({ start: t, end: t + blockMin });
    }
  }
  const fireTimes = blocks.map((b) => HHMM(b.start));
  const lastEnd = blocks.length ? blocks[blocks.length - 1].end : windowEnd;

  // The minute-of-day under the cursor, so hovering the bar reads out the time
  // you're pointing at (the full width maps 00:00 → 24:00).
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  function onMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHoverMin(Math.min(1440, Math.max(0, Math.round(frac * 1440))));
  }
  const hoverLabel =
    hoverMin === null ? null : hoverMin >= 1440 ? "24:00" : HHMM(hoverMin);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-fd-muted-foreground">
        {reserves.length === 0 || blocks.length === 0 ? (
          "Pick a reserve to preview the schedule."
        ) : (
          <>
            On your active days, it activates at{" "}
            <span className="font-medium text-fd-foreground">
              {fireTimes.join(", ")}
            </span>{" "}
            (each lasts {Math.round(blockMin / 60)}h), covering{" "}
            <span className="font-medium text-fd-foreground">
              {HHMM(windowStart)}-{HHMM(lastEnd)}
            </span>{" "}
            once at least the online threshold is met.
          </>
        )}
      </div>

      <div className="relative">
        {hoverLabel && (
          <div
            className="pointer-events-none absolute -top-6 z-10 -translate-x-1/2 rounded bg-fd-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-fd-background shadow-sm"
            style={{ left: `${pct(hoverMin ?? 0)}%` }}
          >
            {hoverLabel}
          </div>
        )}
        <div
          className="relative h-8 w-full overflow-hidden rounded-md bg-fd-secondary/30"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverMin(null)}
        >
          {/* Eligible window band. */}
          <div
            className="absolute inset-y-0 bg-brand/10"
            style={{
              left: `${pct(windowStart)}%`,
              width: `${pct(windowEnd) - pct(windowStart)}%`,
            }}
          />
          {/* Each activation (clipped to the day at 24:00). */}
          {blocks.map((b) => (
            <div
              key={b.start}
              title={`${HHMM(b.start)} - ${HHMM(b.end)}`}
              className="absolute inset-y-1 rounded-sm border border-brand/40 bg-brand/70"
              style={{
                left: `${pct(b.start)}%`,
                width: `${pct(b.end) - pct(b.start)}%`,
              }}
            />
          ))}
          {/* Cursor readout line. */}
          {hoverMin !== null && (
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-fd-foreground/70"
              style={{ left: `${pct(hoverMin)}%` }}
            />
          )}
        </div>
      </div>

      <div className="flex justify-between text-[10px] tabular-nums text-fd-muted-foreground">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>

      {reserves.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
          {reserves.map((r) => (
            <span key={r.type}>
              <span className="text-fd-foreground">{r.name}</span>
              {r.percent != null && (
                <span className="text-brand"> +{r.percent}%</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
