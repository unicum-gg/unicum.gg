import { finalPlacements } from "./placements";
import type { TournamentStage } from "./record";

/**
 * What the tournament decided, which is not always "who won".
 *
 * A knockout ends on one team, and its bracket says so. A qualifier does not:
 * it is drawn as several parallel brackets and sends the top of each one
 * onwards, so it has three winners and no champion. Reading the page could only
 * answer that by opening every group and finding each final, which is a lot of
 * work for the first question anyone asks.
 */
export type TournamentOutcome =
  | { kind: "winner"; teamIds: number[] }
  | { kind: "qualified"; teamIds: number[] }
  | null;

export function tournamentOutcome(
  stages: TournamentStage[],
): TournamentOutcome {
  // A single order over the whole field means a champion, and ties at the top
  // are carried rather than broken: a tournament that ends level ended level.
  const places = finalPlacements(stages);
  if (places.length > 0) {
    const best = places[0]!.position;
    return {
      kind: "winner",
      teamIds: places.filter((p) => p.position === best).map((p) => p.teamId),
    };
  }

  const last = stages[stages.length - 1];
  if (!last) return null;
  // `winnersPerGroup` is what the stage itself says it sends on. Floored at one,
  // since a stage that records none still has a group winner.
  const advancing = Math.max(1, last.winnersPerGroup);
  const teamIds = last.groups.flatMap((group) =>
    group.standings
      .filter((s) => s.position !== null)
      .slice()
      .sort((a, b) => a.position! - b.position!)
      .slice(0, advancing)
      .map((s) => s.teamId),
  );
  return teamIds.length > 0 ? { kind: "qualified", teamIds } : null;
}
