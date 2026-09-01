import { cn } from "@/lib/utils";
import {
  TOURNAMENT_STATUS_LABEL,
  isTournamentLive,
  isTournamentOpen,
} from "@unicum.gg/shared";
import { TournamentStatus } from "@unicum.gg/wargaming";

/**
 * A tournament's lifecycle. Green means it can still be entered, amber means it
 * is being played, muted means it is over.
 *
 * `settled` decides whether a completed tournament says so, and the two answers
 * are both right in their place. Appended to a title in a list of many, it is
 * furniture: completed is the norm across a catalogue going back to 2018, so a
 * grey pill on almost every row says nothing. Sitting in a column of its own it
 * is the opposite, since a blank cell down most of the table reads as missing
 * data rather than as "this one finished".
 *
 * `inline-block` and `whitespace-nowrap` because it sits inside a table cell
 * beside a long title: without them "Registration open" breaks across two lines
 * and the pill splits in half.
 */
export function TournamentStatusBadge({
  status,
  settled = false,
  className,
}: {
  status: TournamentStatus;
  /** Render completed tournaments too, for a column that must not be empty. */
  settled?: boolean;
  className?: string;
}) {
  const done = status === TournamentStatus.Complete;
  if (done && !settled) return null;
  const open = isTournamentOpen(status);
  const live = isTournamentLive(status);
  return (
    <span
      className={cn(
        "inline-block rounded-sm px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase",
        open && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        live && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        // Muted rather than coloured: it is the resting state, and giving it a
        // colour of its own would make the two that need attention compete with
        // the majority of the table.
        done && "bg-fd-muted text-fd-muted-foreground",
        className,
      )}
    >
      {TOURNAMENT_STATUS_LABEL[status]}
    </span>
  );
}
