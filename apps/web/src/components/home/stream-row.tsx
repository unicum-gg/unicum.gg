"use client";

import {
  RatingMetric,
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  wnxColor,
  type LiveStreamer,
} from "@unicum.gg/shared";
import { Period } from "@/hooks/use-period";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Rank on either lifetime or 30-day WN*, driven by the header's period toggle
// (shared with the "Top players" / "Top clans" panels). 30-day reflects who is
// playing well right now rather than career averages.
export const METRIC_VALUE: Record<
  Period,
  Record<RatingMetric, (s: LiveStreamer) => number | null>
> = {
  [Period.Overall]: {
    [RatingMetric.Wn7]: (s) => s.wn7,
    [RatingMetric.Wn8]: (s) => s.wn8,
    [RatingMetric.Wnx]: (s) => s.wnx,
  },
  [Period.Month]: {
    [RatingMetric.Wn7]: (s) => s.wn730d,
    [RatingMetric.Wn8]: (s) => s.wn830d,
    [RatingMetric.Wnx]: (s) => s.wnx30d,
  },
};

const METRIC_COLOR: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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
  const value = METRIC_VALUE[period][metric](streamer);
  return (
    <TableRow
      onClick={onSelect}
      aria-pressed={active}
      className={cn("cursor-pointer", active && "bg-fd-border/50")}
    >
      <TableCell className="pl-4!">
        <div className="truncate">
          <span className="font-medium">{streamer.nickname}</span>
          {streamer.clanTag ? (
            <>
              {" "}
              <ClanTag tag={streamer.clanTag} color={streamer.clanColor} />
            </>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-fd-muted-foreground">
        {intFmt.format(streamer.viewerCount)}
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right font-semibold tabular-nums",
          value != null && METRIC_COLOR[metric](value),
        )}
      >
        {value != null ? intFmt.format(value) : "—"}
      </TableCell>
    </TableRow>
  );
}

export function ClanTag({ tag, color }: { tag: string; color: string | null }) {
  return (
    <span className="font-mono text-xs">
      <span style={{ color: color ?? undefined }}>[</span>
      {tag}
      <span style={{ color: color ?? undefined }}>]</span>
    </span>
  );
}
