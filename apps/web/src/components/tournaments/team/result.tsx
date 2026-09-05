"use client";

import {
  isTournamentLive,
  isTournamentOpen,
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  ordinal,
  winrateColor,
} from "@unicum.gg/shared";
import { TournamentTeamStatus } from "@unicum.gg/wargaming";
import { prizeForPlace } from "@/components/tournaments/detail/prize-tiers";
import {
  ratingColor,
  ratingOf,
  recentRatingOf,
  useRatingMetric,
} from "@/components/tournaments/detail/team-rating";
import type {
  TournamentRecord,
  TournamentTeam,
} from "@/components/tournaments/detail/record";
import type { TeamMatch } from "@/components/tournaments/detail/team-run";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A plain figure: what happened, with the line that puts it in context. */
function Cell({
  label,
  value,
  note,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 border-t border-fd-border px-4 py-3 last:border-b-0 sm:border-t-0 sm:not-last:border-r">
      <span className="text-xs tracking-wide text-fd-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn("text-xl font-semibold tabular-nums", valueClassName)}
      >
        {value}
      </span>
      {note ? (
        <span className="text-xs text-fd-muted-foreground">{note}</span>
      ) : null}
    </div>
  );
}

/**
 * A rating, in the filled column the clan header uses.
 *
 * The colour classes pair a background with white text because they are meant
 * to BE the cell: a rating is read by its colour before its digits, and on a
 * bare figure the same class paints a patch behind the number instead. So the
 * label sits above on the plain ground and the block below carries the colour,
 * exactly as a clan's own averages do.
 */
function MetricColumn({
  label,
  value,
  title,
  colorClass,
}: {
  label: string;
  value: string;
  /** What the average is measured over, which belongs on hover rather than in
   * the column: the teams table puts its denominator in the same place. */
  title?: string;
  colorClass: string | null;
}) {
  return (
    // Sized to its label rather than fixed at the clan header's width: the rank
    // rides in the label here, and a label that wraps to two lines pushes its
    // colour block down out of line with the one beside it.
    <div
      className="flex flex-1 flex-col border-fd-border sm:min-w-32 sm:flex-none sm:shrink-0 sm:border-l"
      title={title}
    >
      <div className="px-4 py-2 text-center text-xs whitespace-nowrap text-fd-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "flex flex-1 items-center justify-center border-t border-fd-border py-2 text-xl font-semibold tabular-nums",
          colorClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The roster's ratings, in the filled columns the clan header carries them in.
 *
 * They belong to the header rather than to the result below it because they are
 * not a result: they describe the players, the way a clan's averages describe
 * its members, and a team page is opened to size up a roster as often as to read
 * how its draw went.
 */
export function TeamMetrics({
  tournament,
  team,
}: {
  tournament: TournamentRecord;
  team: TournamentTeam;
}) {
  const metric = useRatingMetric();
  const rating = ratingOf(team, metric);
  const recent = recentRatingOf(team, metric);
  // A reader on a tournament that has not settled is scouting; one on an
  // archived draw is reading history, and current form is not part of it.
  const scouting =
    isTournamentOpen(tournament.status) || isTournamentLive(tournament.status);
  // The field is the teams that were actually entered in the bracket. A daily
  // draws far more registrations than it confirms (a 29-team draw took 29 of
  // 44), and a team that never made the minimum roster never played anyone, so
  // ranking against it pads the denominator with teams that were not there. The
  // fallback covers a tournament still forming, where nothing is confirmed yet.
  const entered = tournament.teams.filter(
    (t) => t.status === TournamentTeamStatus.Confirmed,
  );
  const field = entered.length > 0 ? entered : tournament.teams;
  // Ranked against the teams we can rate, not the whole field: a team with no
  // rated player is not "last", it is unmeasured, and counting it would move
  // everyone else's rank.
  const rated = field
    .map((t) => ratingOf(t, metric))
    .filter((v): v is number => v !== null);
  const rank =
    rating === null ? null : rated.filter((v) => v > rating).length + 1;
  const winrate = team.avgWinrate;

  if (rating === null && recent === null && winrate === null) return null;

  return (
    <div className="flex border-t border-fd-border sm:contents sm:border-t-0">
      {/* Form before career, the order the clan header uses, and only while the
          tournament is still ahead or being played: the window is the last 30
          days from now, so on a settled tournament it would describe who these
          players are today under a heading a reader takes for how they arrived
          on the night. */}
      {scouting && recent !== null && (
        <MetricColumn
          label={`Avg ${RATING_METRIC_LABEL[metric]} · 30d`}
          value={intFmt.format(recent)}
          title={`Average over the ${team.rated30dPlayers} of ${team.players.length} players who played in the last 30 days`}
          colorClass={ratingColor(recent, metric)}
        />
      )}
      {rating !== null && (
        <MetricColumn
          // The rank rides in the label, the way the clan header hangs its own
          // window there ("Avg WNX · 30d"): the filled block is the figure and
          // nothing else fits in it.
          label={
            rank === null
              ? `Avg ${RATING_METRIC_LABEL[metric]}`
              : `Avg ${RATING_METRIC_LABEL[metric]} · ${ordinal(rank)} of ${rated.length}`
          }
          value={intFmt.format(rating)}
          title={`Average over ${team.ratedPlayers} of ${team.players.length} players`}
          colorClass={ratingColor(rating, metric)}
        />
      )}
      {winrate !== null && Number.isFinite(winrate) && (
        <MetricColumn
          label="Avg winrate"
          value={`${pctFmt.format(winrate * 100)}%`}
          colorClass={RATING_COLOR_CLASS[winrateColor(winrate)]}
        />
      )}
    </div>
  );
}

/**
 * How the run ended: where they finished, what it paid, and their record.
 *
 * Every one of the three is a join Wargaming's own team page cannot make. It
 * knows the bracket, so it could say where the team finished and never does, and
 * the prize table lives on the tournament and names bands, not teams, so what a
 * run was worth is stated nowhere.
 */
export function TeamResult({
  tournament,
  run,
  /** The team's finishing place, absent while the tournament is undecided. */
  place,
  /** How many teams the tournament placed, the floor for the field size. */
  placedTeams,
}: {
  tournament: TournamentRecord;
  run: TeamMatch[];
  place: number | undefined;
  placedTeams: number;
}) {
  // Wargaming's own count of the entered field, which is the denominator a
  // placing is read against. It can lag what we mirrored, so a tournament that
  // placed more teams than it says it confirmed reports the larger of the two
  // rather than a place outside its own field.
  const fieldSize = Math.max(tournament.confirmedTeams, placedTeams);

  const decided = run.filter((m) => m.won !== null);
  const wins = decided.filter((m) => m.won).length;
  const losses = decided.length - wins;
  const prize =
    place === undefined ? null : prizeForPlace(tournament.prizeTiers, place);

  if (place === undefined && prize === null && decided.length === 0) return null;

  return (
    <div className="flex flex-col border-t border-fd-border sm:flex-row">
      {place !== undefined && (
        <Cell
          label="Finished"
          value={ordinal(place)}
          note={fieldSize > 0 ? `of ${fieldSize} teams` : undefined}
        />
      )}
      {/* A band's reward is the organiser's own sentence ("5600 gold (team
          reward)"), not a figure, so it is set at reading size rather than at
          the display size the placing and the record use. */}
      {prize && <Cell label="Won" value={prize} valueClassName="text-base" />}
      {decided.length > 0 && (
        <Cell
          label="Record"
          value={`${wins}-${losses}`}
          note={`${decided.length} ${decided.length === 1 ? "tie" : "ties"} played`}
        />
      )}
    </div>
  );
}
