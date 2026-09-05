import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  tournamentMatchesByRegion,
  tournamentStagesByRegion,
  tournamentTeamsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** How much of a tournament's bracket the mirror already holds. */
export type HeldBracket = {
  stages: number;
  matches: number;
};

/**
 * The size of the mirrored bracket, as the two numbers that decide whether an
 * incoming one is poorer.
 *
 * Matches as well as stages, because Wargaming's purge is not all-or-nothing:
 * a tournament can come back carrying its stages with the tree under them gone,
 * and a check that only asked "are there stages" would read that as a bracket
 * arriving and overwrite the real one with an empty shell.
 */
export async function heldBracket(
  region: Region,
  tournamentId: number,
): Promise<HeldBracket> {
  const stages = tournamentStagesByRegion[region];
  const matches = tournamentMatchesByRegion[region];
  const [row] = await db
    .select({
      stages: sql<number>`(select count(*)::int from ${stages}
        where ${stages.tournamentId} = ${tournamentId})`,
      matches: sql<number>`(select count(*)::int from ${matches}
        where ${matches.tournamentId} = ${tournamentId})`,
    })
    .from(sql`(select 1) as one`);
  return { stages: row?.stages ?? 0, matches: row?.matches ?? 0 };
}

/**
 * How many teams the mirror already holds for a tournament.
 *
 * The roster twin of {@link heldBracket}: a fetch that came back with fewer
 * teams than this is a poorer answer, not a tournament that shrank, and
 * replacing on it would delete rosters that exist nowhere else.
 */
export async function heldTeamCount(
  region: Region,
  tournamentId: number,
): Promise<number> {
  const teams = tournamentTeamsByRegion[region];
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teams)
    .where(sql`${teams.tournamentId} = ${tournamentId}`);
  return row?.n ?? 0;
}
