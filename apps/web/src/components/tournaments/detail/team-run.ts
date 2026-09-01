import { BracketType } from "@unicum.gg/wargaming";
import { orderedRounds } from "./layout";
import type { TournamentRecord, TournamentStage } from "./record";

/** Which slot a team occupied in a tie. */
export enum TeamSlot {
  One = 1,
  Two = 2,
}

/** One map a tie was played on, linked and drawable when the catalogue knows
 * it. `pool` is the catalogue entry, carrying the minimap and the two sides'
 * spawns; null for a name the pool does not contain. */
export type PlayedMap = {
  label: string;
  slug: string | null;
  pool: TournamentRecord["mapPool"][number] | null;
};

/** One tie from one team's point of view. */
export type TeamMatch = {
  uuid: string;
  stageTitle: string;
  bracketType: BracketType;
  round: number;
  groupOrder: number;
  groupCount: number;
  opponent: string | null;
  /** The other side's id, so the tie links to their page. Null on a bye. */
  opponentId: number | null;
  /** The clan behind the other side, when one was resolved. */
  opponentClan: {
    clanTag: string;
    clanColor: string | null;
  } | null;
  /** Both sides by name, so a minimap can label the spawn each one started on. */
  team1Name: string | null;
  team2Name: string | null;
  /**
   * Which side of the draw the team was on.
   *
   * This is the answer to "which side do we spawn on", and the only one the
   * tournament system publishes: it assigns each tie a team 1 and a team 2, and
   * the tournament's own rules say what that means on the map (typically team 1
   * starts at base 1 and team 2 at base 2, with named map exceptions). So the
   * slot is recorded and the rules are rendered beside it, rather than the side
   * being asserted here from a convention that is per-tournament.
   */
  slot: TeamSlot;
  scoreFor: number | null;
  scoreAgainst: number | null;
  /** Null while the tie has no recorded winner. */
  won: boolean | null;
  maps: PlayedMap[];
  startAt: Date | null;
};

/**
 * Split the organiser's free-text map list and link what the catalogue knows.
 *
 * The field is prose, not ids ("Cliff, Sand River"), so the join is by name
 * against this tournament's own pool, which is where the arena ids were already
 * resolved. Anything that does not match stays as the text it is.
 */
export function playedMaps(
  maps: string | null,
  pool: TournamentRecord["mapPool"],
): PlayedMap[] {
  const byName = new Map(
    pool.filter((m) => m.name).map((m) => [m.name!.toLowerCase(), m]),
  );
  return splitMapLabels(maps).map((label) => {
    const entry = byName.get(label.toLowerCase()) ?? null;
    return { label, slug: entry?.slug ?? null, pool: entry };
  });
}

/** The organiser's map field, as the list of names it spells out. Shared so the
 * bracket cards and a team's run split it the same way. */
export function splitMapLabels(maps: string | null): string[] {
  if (!maps) return [];
  return maps
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

/** Ties in the order they were played, across every stage of the tournament. */
function orderedMatches(stages: TournamentStage[]) {
  return stages.flatMap((stage) =>
    stage.groups.flatMap((group) => {
      const rounds = orderedRounds(
        [...new Set(group.matches.map((m) => m.round))],
        stage.bracketType,
      );
      const rank = new Map(rounds.map((r, i) => [r, i]));
      return group.matches
        .slice()
        .sort(
          (a, b) =>
            (rank.get(a.round) ?? 0) - (rank.get(b.round) ?? 0) ||
            a.position - b.position,
        )
        .map((match) => ({ match, stage, group }));
    }),
  );
}

/**
 * One team's run through a tournament, in the order it was played.
 *
 * Assembled from the bracket the page already holds rather than from a fetch of
 * its own: a tournament is small and every tie is already on the client, so a
 * team's path is a filter over it.
 */
export function teamRun(
  tournament: TournamentRecord,
  teamId: number,
): TeamMatch[] {
  const names = new Map(tournament.teams.map((t) => [t.id, t.title]));
  const clans = new Map(
    tournament.teams
      .filter((t) => t.clan)
      .map((t) => [t.id, { clanTag: t.clan!.clanTag, clanColor: t.clan!.clanColor }]),
  );
  const out: TeamMatch[] = [];
  for (const { match, stage, group } of orderedMatches(tournament.stages)) {
    const isOne = match.team1Id === teamId;
    const isTwo = match.team2Id === teamId;
    if (!isOne && !isTwo) continue;
    const opponentId = isOne ? match.team2Id : match.team1Id;
    const scoreFor = isOne ? match.winsTeam1 : match.winsTeam2;
    const scoreAgainst = isOne ? match.winsTeam2 : match.winsTeam1;
    out.push({
      uuid: match.uuid,
      stageTitle: stage.title,
      bracketType: stage.bracketType,
      round: match.round,
      groupOrder: group.order,
      groupCount: stage.groups.length,
      opponent: opponentId === null ? null : (names.get(opponentId) ?? null),
      opponentId,
      opponentClan: opponentId === null ? null : (clans.get(opponentId) ?? null),
      team1Name:
        match.team1Id === null ? null : (names.get(match.team1Id) ?? null),
      team2Name:
        match.team2Id === null ? null : (names.get(match.team2Id) ?? null),
      slot: isOne ? TeamSlot.One : TeamSlot.Two,
      scoreFor,
      scoreAgainst,
      won:
        match.winnerTeamId === null ? null : match.winnerTeamId === teamId,
      maps: playedMaps(match.maps, tournament.mapPool),
      startAt: match.startAt,
    });
  }
  return out;
}
