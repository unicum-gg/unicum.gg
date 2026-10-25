"use client";

import { useFormat } from "@/hooks/use-format";
import {
  RatingMetric,
  ratingColorClass,
  type LiveStreamer,
} from "@unicum.gg/shared";
import { Period } from "@/hooks/use-period";
import { ClanTag } from "@/components/entity/clan-tag";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Rank on either the lifetime rating or the 30-day one, driven by the header's
// period toggle (shared with the "Top players" / "Top clans" panels). 30-day
// reflects who is playing well right now rather than career averages. PR and
// WTR have no value over a window, so on those two the rail keeps the current
// figure: every streamer on it is active by definition.
const LIFETIME_VALUE: Record<RatingMetric, (s: LiveStreamer) => number | null> = {
  [RatingMetric.Wn7]: (s) => s.wn7,
  [RatingMetric.Wn8]: (s) => s.wn8,
  [RatingMetric.Wnx]: (s) => s.wnx,
  // Absent on a payload cached before the two were added.
  [RatingMetric.Pr]: (s) => s.pr ?? null,
  [RatingMetric.Wtr]: (s) => s.wtr ?? null,
};

const MONTH_VALUE: Record<RatingMetric, (s: LiveStreamer) => number | null> = {
  [RatingMetric.Wn7]: (s) => s.wn730d,
  [RatingMetric.Wn8]: (s) => s.wn830d,
  [RatingMetric.Wnx]: (s) => s.wnx30d,
  [RatingMetric.Pr]: LIFETIME_VALUE[RatingMetric.Pr],
  [RatingMetric.Wtr]: LIFETIME_VALUE[RatingMetric.Wtr],
};

/** A streamer's rating in the reader's pick over a period. */
export function streamValue(
  s: LiveStreamer,
  metric: RatingMetric,
  period: Period,
): number | null {
  return (period === Period.Month ? MONTH_VALUE : LIFETIME_VALUE)[metric](s);
}

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** One live streamer in the rail's table, coloured like the leaderboards. */
export function StreamRow({
  streamer,
  metric,
  period,
  active,
  onSelect,
}: {
  streamer: LiveStreamer;
  metric: RatingMetric;
  period: Period;
  active: boolean;
  onSelect: () => void;
}) {
  const { num } = useFormat();
  const value = streamValue(streamer, metric, period);
  return (
    <TableRow
      onClick={onSelect}
      // `aria-current`, not `aria-pressed`: a row is not a toggle, and
      // `aria-pressed` on a `<tr>` is the attribute-vs-role mismatch Lighthouse
      // fails the page on. What is true here is that this row is the one the
      // featured player is on, which is what `aria-current` says.
      aria-current={active ? "true" : undefined}
      className={cn("cursor-pointer", active && "bg-fd-border/50")}
    >
      <TableCell className="pl-4!">
        <div className="truncate">
          <span className="font-medium">{streamer.nickname}</span>
          {streamer.clanTag ? (
            <>
              {" "}
              <ClanTag
                tag={streamer.clanTag}
                color={streamer.clanColor}
                className="font-mono text-xs"
              />
            </>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-fd-muted-foreground">
        {num(INT_FORMAT).format(streamer.viewerCount)}
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right font-semibold tabular-nums",
          value != null &&
            ratingColorClass(metric, value),
        )}
      >
        {value != null ? num(INT_FORMAT).format(value) : "—"}
      </TableCell>
    </TableRow>
  );
}
