import { TournamentGameMode, TournamentStatus } from "@unicum.gg/wargaming";

/**
 * How a tournament reads to a player. The tournament system names its own modes
 * in every response, but only inside the payload we do not keep (a mode arrives
 * as a `{ code, title }` pair and only the code is stored), so the display name
 * is mapped here once for the site and the bot rather than carried on every row.
 */
export const TOURNAMENT_GAME_MODE_LABEL: Record<TournamentGameMode, string> = {
  [TournamentGameMode.Standard]: "Standard",
  [TournamentGameMode.Encounter]: "Encounter",
  [TournamentGameMode.AttackDefense]: "Attack/Defense",
  [TournamentGameMode.Onslaught]: "Onslaught",
};

/** Whether a tournament can still be entered. */
export function isTournamentOpen(status: TournamentStatus): boolean {
  return (
    status === TournamentStatus.Upcoming ||
    status === TournamentStatus.RegistrationStarted
  );
}

/** Whether a tournament is being played right now, or settling. */
export function isTournamentLive(status: TournamentStatus): boolean {
  return (
    status === TournamentStatus.RegistrationFinished ||
    status === TournamentStatus.Running ||
    status === TournamentStatus.Finished
  );
}

/** A short badge word for a tournament's lifecycle state. */
export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  [TournamentStatus.Upcoming]: "Upcoming",
  [TournamentStatus.RegistrationStarted]: "Registration open",
  [TournamentStatus.RegistrationFinished]: "Registration closed",
  [TournamentStatus.Running]: "In progress",
  [TournamentStatus.Finished]: "Finishing",
  [TournamentStatus.Complete]: "Completed",
};

/**
 * A placement as English reads it: 1st, 2nd, 3rd, 4th, 11th, 21st.
 *
 * The teens are the whole reason this is not a lookup on the last digit: 11, 12
 * and 13 take "th" while 21, 22 and 23 take st/nd/rd.
 */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const unit = n % 10;
  if (unit === 1) return `${n}st`;
  if (unit === 2) return `${n}nd`;
  if (unit === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * How a tournament's format reads: "7v7", "1v1", "15v15".
 *
 * Built from the roster MINIMUM, because that is the battle size: the daily
 * ladder billed as "7v7 Tier X" reports min 7 and max 8, and the clan showdown
 * played 15 a side reports 15 and 18. The maximum is the bench a team may
 * register on top, so folding both into "7-8" would name neither the battle nor
 * the roster. {@link rosterLimits} says the second half when it is wanted.
 */
export function teamFormat(min: number): string {
  return `${min}v${min}`;
}

/** The roster a team may register, when it is larger than the battle size:
 * "7 to 8 players". Null when the two match and there is no bench to mention. */
export function rosterLimits(min: number, max: number): string | null {
  return max > min ? `${min} to ${max} players` : null;
}
