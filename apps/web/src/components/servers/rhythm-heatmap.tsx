"use client";

import { useMemo } from "react";
import {
  busiestRhythmCell,
  localRhythm,
  quietestRhythmCell,
  RHYTHM_HOURS,
  RHYTHM_WEEKDAYS,
  type ServerRhythmCell,
} from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatPlayers, WEEKDAY_LABEL } from "./format";

/**
 * When the region is actually busy: the average population of every hour of the
 * week, as a 7x24 grid.
 *
 * The payload is recorded and returned in UTC, which is the only timezone a
 * server can honestly answer in, and this shifts it into the reader's own
 * before drawing. Until hydration it renders the UTC grid, so the server and
 * the first client render agree and React keeps the tree; the label says which
 * of the two is on screen rather than leaving the reader to guess.
 *
 * An hour the sampler has never covered is drawn empty rather than dark, since
 * "no data" and "nobody playing" are the same colour otherwise, and for the
 * first weeks of recording most of the grid is the former.
 */
export function RhythmHeatmap({ rhythm }: { rhythm: ServerRhythmCell[] }) {
  const hydrated = useHydrated();

  const cells = useMemo(() => {
    if (!hydrated) return rhythm;
    return localRhythm(rhythm, -new Date().getTimezoneOffset() / 60);
  }, [rhythm, hydrated]);

  const grid = useMemo(() => {
    const rows: ServerRhythmCell[][] = Array.from(
      { length: RHYTHM_WEEKDAYS },
      (_, i) =>
        Array.from({ length: RHYTHM_HOURS }, (_, hour) => ({
          weekday: i + 1,
          hour,
          average: 0,
          samples: 0,
        })),
    );
    for (const cell of cells) {
      const row = rows[cell.weekday - 1];
      if (row) row[cell.hour] = cell;
    }
    return rows;
  }, [cells]);

  const busiest = useMemo(() => busiestRhythmCell(cells), [cells]);
  // Only worth naming once two hours have been sampled: with one, the busiest
  // and the quietest are the same cell and printing both reads as a mistake.
  const quietest = useMemo(() => {
    const cell = quietestRhythmCell(cells);
    if (!cell || !busiest) return null;
    const same = cell.weekday === busiest.weekday && cell.hour === busiest.hour;
    return same ? null : cell;
  }, [cells, busiest]);
  const max = busiest?.average ?? 0;

  if (!busiest) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        Not enough recorded yet to show a weekly rhythm. It fills in as the
        sampling covers each hour of the week.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <TooltipProvider delayDuration={100}>
        <div className="overflow-x-auto">
          {/* `table-fixed` so all 24 hours are the same width. Left to `auto`,
              each column sizes to its content and the eight columns carrying an
              hour label come out wider than the sixteen blank ones, which reads
              as a rhythm in the data that is not there. */}
          <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="w-10" />
                {Array.from({ length: RHYTHM_HOURS }, (_, hour) => (
                  <th
                    key={hour}
                    className="text-center text-[10px] font-normal tabular-nums text-fd-muted-foreground"
                  >
                    {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={WEEKDAY_LABEL[i]}>
                  <th className="pe-2 text-right text-[11px] font-normal text-fd-muted-foreground">
                    {WEEKDAY_LABEL[i]}
                  </th>
                  {row.map((cell) => (
                    <td key={cell.hour} className="p-0">
                      <HourCell
                        cell={cell}
                        weekday={WEEKDAY_LABEL[i]}
                        max={max}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TooltipProvider>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-fd-muted-foreground">
          Busiest{" "}
          <span className="font-medium text-fd-foreground">
            {WEEKDAY_LABEL[busiest.weekday - 1]}{" "}
            {String(busiest.hour).padStart(2, "0")}:00
          </span>{" "}
          ({formatPlayers(busiest.average)})
          {quietest ? (
            <>
              , quietest{" "}
              <span className="font-medium text-fd-foreground">
                {WEEKDAY_LABEL[quietest.weekday - 1]}{" "}
                {String(quietest.hour).padStart(2, "0")}:00
              </span>{" "}
              ({formatPlayers(quietest.average)})
            </>
          ) : null}
          .
        </p>
        <p className="text-xs text-fd-muted-foreground">
          {hydrated ? "Your local time" : "UTC"}
        </p>
      </div>
    </div>
  );
}

/**
 * One hour of the grid.
 *
 * The figure rides in a real tooltip rather than the native `title`, which
 * appears only after the browser's own delay, cannot be styled and reads
 * nothing like the rest of the site. `aria-label` stays so the value is still
 * announced, since the tooltip's own text lives in a portal the cell does not
 * own.
 */
function HourCell({
  cell,
  weekday,
  max,
}: {
  cell: ServerRhythmCell;
  weekday: string;
  max: number;
}) {
  const when = `${weekday} ${String(cell.hour).padStart(2, "0")}:00`;
  // `max` is the busiest average, which is zero when every sampled hour held
  // nobody (Wargaming does report a cluster at zero, and the sampler writes
  // that). Dividing by it would emit `color-mix(... NaN% ...)`, an invalid
  // declaration the browser drops, blanking the whole grid.
  const sampled = cell.samples > 0 && max > 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="h-5 rounded-[2px] border border-fd-border/40"
          style={
            sampled
              ? {
                  backgroundColor: `color-mix(in oklab, var(--brand) ${Math.round(
                    (cell.average / max) * 100,
                  )}%, transparent)`,
                }
              : undefined
          }
          aria-label={
            sampled
              ? `${when}, ${formatPlayers(cell.average)} players on average`
              : `${when}, not sampled yet`
          }
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{when}</span>
          <span className="text-background/70">
            {sampled
              ? `${formatPlayers(cell.average)} players on average`
              : "Not sampled yet"}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
