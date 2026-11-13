import { and, eq, gt, inArray, sql } from "drizzle-orm";
import {
  clansByRegion,
  finalPlacements,
  placeSpans,
  playersByRegion,
  tournamentGroupsByRegion,
  tournamentStagesByRegion,
  tournamentStandingsByRegion,
  tournamentTeamPlayersByRegion,
  tournamentTeamsByRegion,
  tournamentsByRegion,
  type PlacementStage,
} from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";
import { db } from "../db";
import { isArchived } from "./archived";

/** A tournament's finishing order: every placed team and where it finished. */
type Placed = {
  /** teamId to the place as a ranking is written, so a tie takes its BEST
   * place: the knockout stores both beaten semi-finalists at 4 and they are
   * both 3rd here, which is what the bracket page shows. */
  places: Map<number, number>;
};

/**
 * Where every team finished, read by the SAME rule the bracket page draws.
 *
 * `finalPlacements` lives in shared for exactly this: the two used to run on
 * separate copies and disagreed. A third-place match is filed as its own
 * single-group stage, so taking the last stage at face value crowned the team
 * that won the match FOR THIRD (EU 5000015153 credited Piranhas while the page
 * showed ENIGMA). The shared rule identifies a decider by its shape, not by its
 * title, and uses it to split a tie rather than to replace the ranking.
 *
 * This is also what the profile and clan tables read, through `final_place` on
 * the team row. They used to take `min(position)` over every group a team
 * appears in, which is the best place reached in ANY pool of any stage: EU
 * published 178,330 first places that way, against 13,170 tournaments.
 *
 * Only settled tournaments count. This runs on every live mirror, five minutes
 * apart, and a round robin in play has a leader sitting at position 1: without
 * the gate a crest appeared for a tournament nobody had won yet, then moved to
 * whoever led next.
 *
 * BOUND IT. Unbounded, this reads every standing of every settled tournament in
 * the region, which is 1.2s at the quiet floor and 2.9s at peak on EU, and the
 * live mirror calls it per tournament every five minutes. Only the backfill,
 * which rewrites the whole column by design, may leave `tournamentIds` out.
 */
async function placementsOf(
  region: Region,
  tournamentIds?: number[],
): Promise<Map<number, Placed>> {
  const tournaments = tournamentsByRegion[region];
  const stages = tournamentStagesByRegion[region];
  const groups = tournamentGroupsByRegion[region];
  const standings = tournamentStandingsByRegion[region];

  const settled = isArchived(tournaments);

  const rows = await db
    .select({
      tournamentId: tournaments.id,
      stageId: stages.id,
      stageStartAt: stages.startAt,
      groupId: groups.id,
      teamId: standings.teamId,
      position: standings.position,
    })
    .from(standings)
    .innerJoin(groups, eq(groups.id, standings.groupId))
    .innerJoin(stages, eq(stages.id, groups.stageId))
    .innerJoin(tournaments, eq(tournaments.id, standings.tournamentId))
    .where(
      tournamentIds?.length
        ? and(settled, inArray(standings.tournamentId, tournamentIds))
        : settled,
    );

  // Rebuilt into the shape the shared rule reads: stages in the order it walks
  // them (by start, then id, the same order the page receives), each holding
  // its groups, each holding its standings.
  const byTournament = new Map<
    number,
    Map<number, { startAt: Date | null; groups: Map<number, PlacementStage["groups"][number]["standings"]> }>
  >();
  for (const row of rows) {
    const tid = Number(row.tournamentId);
    let stageMap = byTournament.get(tid);
    if (!stageMap) byTournament.set(tid, (stageMap = new Map()));
    const sid = Number(row.stageId);
    let stage = stageMap.get(sid);
    if (!stage) stageMap.set(sid, (stage = { startAt: row.stageStartAt, groups: new Map() }));
    const gid = Number(row.groupId);
    let group = stage.groups.get(gid);
    if (!group) stage.groups.set(gid, (group = []));
    group.push({ teamId: Number(row.teamId), position: row.position });
  }

  const out = new Map<number, Placed>();
  for (const [tid, stageMap] of byTournament) {
    const ordered: PlacementStage[] = [...stageMap.entries()]
      .sort(([aId, a], [bId, b]) => {
        const at = a.startAt?.getTime() ?? 0;
        const bt = b.startAt?.getTime() ?? 0;
        return at === bt ? aId - bId : at - bt;
      })
      .map(([, stage]) => ({ groups: [...stage.groups.values()].map((standings) => ({ standings })) }));
    const stored = new Map(
      finalPlacements(ordered).map((p) => [p.teamId, p.position]),
    );
    const spans = placeSpans(stored);
    const places = new Map(
      [...stored].map(([teamId, position]) => [
        teamId,
        spans.get(position)?.from ?? position,
      ]),
    );
    out.set(tid, { places });
  }
  return out;
}

/**
 * The tournaments that were won, and by whom, read from `final_place` on the
 * team row rather than recomputed from the brackets.
 *
 * That column is written by `writeFinalPlaces` from `finalPlacements`, so this
 * is the same rule read one hop later and not a second definition of it.
 *
 * Reading it back is what lets the honours be counted without the archive.
 * Recomputing them in memory meant every mirror of every tournament read every
 * standing of every settled tournament in the region, then threw away all but
 * the handful of accounts in scope. Measured over 56 days: 2.9s a call and
 * 277,121 calls on EU, 3.9s and 122,728 on NA, 352 hours of database time and
 * 11.5% of everything it did. A settled tournament is immutable, so all but one
 * of those reads could only ever return what the column already held.
 *
 * `final_place` is complete wherever a bracket exists, which was measured
 * before this relied on it: zero settled tournaments carrying standings are
 * missing `placements_at` on any of the three regions. The ones that lack it
 * (11,401 on EU) hold no standings at all, being the id-space recoveries whose
 * brackets Wargaming had already purged, so they crowned nobody either way.
 *
 * Every team sharing the best place is a winner, not the first one found: a
 * tournament that ended level ended level, which is how the bracket page reads
 * it too (`tournamentOutcome`).
 */
function wonTeams(region: Region) {
  const teams = tournamentTeamsByRegion[region];
  const tournaments = tournamentsByRegion[region];
  return sql`
    SELECT tt.${sql.raw(teams.id.name)} AS team_id,
           t.${sql.raw(tournaments.title.name)} AS title,
           t.${sql.raw(tournaments.startAt.name)} AS start_at,
           t.${sql.raw(tournaments.isFeatured.name)} AS is_featured
    FROM ${teams} tt
    JOIN ${tournaments} t
      ON t.${sql.raw(tournaments.id.name)} = tt.${sql.raw(teams.tournamentId.name)}
    WHERE tt.${sql.raw(teams.finalPlace.name)} = 1
  `;
}

/**
 * Write the honours of a set of accounts, from the wins handed in.
 *
 * Two statements rather than one: a reset and a set against the same rows of the
 * same table inside a single `WITH` is documented as unpredictable in Postgres
 * (the sub-statements cannot see each other, and a row touched by both has no
 * defined outcome). Reset first so an account that LOST a win drops to zero
 * rather than keeping a figure nothing supports.
 */
async function writePlayerHonours(
  region: Region,
  accountScope: ReturnType<typeof sql>,
) {
  const players = playersByRegion[region];
  const teamPlayers = tournamentTeamPlayersByRegion[region];
  await db.execute(sql`
    UPDATE ${players}
    SET ${sql.raw(players.tournamentWins.name)} = 0,
        ${sql.raw(players.tournamentFeaturedWins.name)} = 0,
        ${sql.raw(players.tournamentBestTitle.name)} = NULL,
        ${sql.raw(players.tournamentBestAt.name)} = NULL
    WHERE ${sql.raw(players.accountId.name)} IN (${accountScope})
      AND ${sql.raw(players.tournamentWins.name)} > 0
  `);
  await db.execute(sql`
    WITH won AS (${wonTeams(region)}),
    tally AS (
      SELECT p.${sql.raw(teamPlayers.accountId.name)} AS account_id,
             count(*)::int AS wins,
             count(*) FILTER (WHERE w.is_featured)::int AS featured,
             (array_agg(w.title ORDER BY w.is_featured DESC, w.start_at DESC NULLS LAST))[1] AS best_title,
             (array_agg(w.start_at ORDER BY w.is_featured DESC, w.start_at DESC NULLS LAST))[1] AS best_at
      FROM won w
      JOIN ${teamPlayers} p ON p.${sql.raw(teamPlayers.teamId.name)} = w.team_id
      WHERE p.${sql.raw(teamPlayers.accountId.name)} IN (${accountScope})
      GROUP BY 1
    )
    UPDATE ${players} pl
    SET ${sql.raw(players.tournamentWins.name)} = t.wins,
        ${sql.raw(players.tournamentFeaturedWins.name)} = t.featured,
        ${sql.raw(players.tournamentBestTitle.name)} = t.best_title,
        ${sql.raw(players.tournamentBestAt.name)} = t.best_at
    FROM tally t
    WHERE pl.${sql.raw(players.accountId.name)} = t.account_id
  `);
}

/** The clan twin: a clan's win is a win by a team ATTRIBUTED to it, which is the
 * `clan_id` the mirror resolves from the roster as of the day it was played. */
async function writeClanHonours(
  region: Region,
  clanScope: ReturnType<typeof sql>,
) {
  const clans = clansByRegion[region];
  const teams = tournamentTeamsByRegion[region];
  await db.execute(sql`
    UPDATE ${clans}
    SET ${sql.raw(clans.tournamentWins.name)} = 0,
        ${sql.raw(clans.tournamentFeaturedWins.name)} = 0,
        ${sql.raw(clans.tournamentBestTitle.name)} = NULL,
        ${sql.raw(clans.tournamentBestAt.name)} = NULL
    WHERE ${sql.raw(clans.id.name)} IN (${clanScope})
      AND ${sql.raw(clans.tournamentWins.name)} > 0
  `);
  await db.execute(sql`
    WITH won AS (${wonTeams(region)}),
    tally AS (
      SELECT tt.${sql.raw(teams.clanId.name)} AS clan_id,
             count(*)::int AS wins,
             count(*) FILTER (WHERE w.is_featured)::int AS featured,
             (array_agg(w.title ORDER BY w.is_featured DESC, w.start_at DESC NULLS LAST))[1] AS best_title,
             (array_agg(w.start_at ORDER BY w.is_featured DESC, w.start_at DESC NULLS LAST))[1] AS best_at
      FROM won w
      JOIN ${teams} tt ON tt.${sql.raw(teams.id.name)} = w.team_id
      WHERE tt.${sql.raw(teams.clanId.name)} IN (${clanScope})
      GROUP BY 1
    )
    UPDATE ${clans} c
    SET ${sql.raw(clans.tournamentWins.name)} = t.wins,
        ${sql.raw(clans.tournamentFeaturedWins.name)} = t.featured,
        ${sql.raw(clans.tournamentBestTitle.name)} = t.best_title,
        ${sql.raw(clans.tournamentBestAt.name)} = t.best_at
    FROM tally t
    WHERE c.${sql.raw(clans.id.name)} = t.clan_id
  `);
}

/**
 * How many rows one statement carries. The archive write places 148,675 teams
 * on EU, which is one `VALUES` list no statement should be handed, while the
 * per-tournament write is a few hundred and fits in one.
 */
const WRITE_CHUNK = 2000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Write where every team finished, and stamp the tournaments it was read from.
 *
 * `scope` is the tournaments being rewritten, which is NOT the same as the ones
 * that have a placement: a bracket that changed can take a place away as well
 * as give one, so the scope is cleared first and only then filled, or a team
 * demoted out of the deciding stage would keep a place nothing supports.
 *
 * The stamp separates "no final place" from "not read yet", which the tables
 * reading this column depend on: a team knocked out in the pools really has
 * none, and labelling an unread tournament the same way would publish its
 * champion as a group winner.
 */
async function writeFinalPlaces(
  region: Region,
  placed: Map<number, Placed>,
  scope: number[] | null,
): Promise<void> {
  const teams = tournamentTeamsByRegion[region];
  const tournaments = tournamentsByRegion[region];

  if (scope === null) {
    await db.execute(sql`
      UPDATE ${teams} SET ${sql.raw(teams.finalPlace.name)} = NULL
      WHERE ${sql.raw(teams.finalPlace.name)} IS NOT NULL
    `);
  } else if (scope.length > 0) {
    await db.execute(sql`
      UPDATE ${teams} SET ${sql.raw(teams.finalPlace.name)} = NULL
      WHERE ${sql.raw(teams.tournamentId.name)} IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})
        AND ${sql.raw(teams.finalPlace.name)} IS NOT NULL
    `);
  }

  const rows: { teamId: number; place: number }[] = [];
  for (const { places } of placed.values()) {
    for (const [teamId, place] of places) rows.push({ teamId, place });
  }
  for (const batch of chunks(rows, WRITE_CHUNK)) {
    await db.execute(sql`
      WITH placed(team_id, place) AS (VALUES ${sql.join(
        batch.map((r) => sql`(${r.teamId}::bigint, ${r.place}::int)`),
        sql`, `,
      )})
      UPDATE ${teams} t
      SET ${sql.raw(teams.finalPlace.name)} = p.place
      FROM placed p
      WHERE t.${sql.raw(teams.id.name)} = p.team_id
    `);
  }

  // Stamped even for a tournament whose brackets decided nothing: the read
  // happened, and its teams' absent places are an answer rather than a gap.
  for (const batch of chunks([...placed.keys()], WRITE_CHUNK)) {
    await db.execute(sql`
      UPDATE ${tournaments} SET ${sql.raw(tournaments.placementsAt.name)} = now()
      WHERE ${sql.raw(tournaments.id.name)} IN (${sql.join(
        batch.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
  }
}

/**
 * Refresh the honours of everyone a tournament involved, players and clans, and
 * record where each of its teams finished.
 *
 * Scoped to the tournament rather than to its winners: a bracket that changed
 * can take a win away as well as give one, and the losing side has to be
 * recomputed for the counter to go back down. Both scopes are read from the
 * whole archive, so a player with wins elsewhere keeps them.
 */
export async function recordTournamentWinners(
  region: Region,
  tournamentId: number,
): Promise<void> {
  const teams = tournamentTeamsByRegion[region];
  const teamPlayers = tournamentTeamPlayersByRegion[region];
  const accountScope = sql`
    SELECT DISTINCT p.${sql.raw(teamPlayers.accountId.name)}
    FROM ${teamPlayers} p
    JOIN ${teams} tt ON tt.${sql.raw(teams.id.name)} = p.${sql.raw(teamPlayers.teamId.name)}
    WHERE tt.${sql.raw(teams.tournamentId.name)} = ${tournamentId}
  `;
  const clanScope = sql`
    SELECT DISTINCT tt.${sql.raw(teams.clanId.name)}
    FROM ${teams} tt
    WHERE tt.${sql.raw(teams.tournamentId.name)} = ${tournamentId}
      AND tt.${sql.raw(teams.clanId.name)} IS NOT NULL
  `;
  // This tournament's own brackets, and nothing else. The honours are then
  // counted from `final_place`, which already carries every other tournament's
  // verdict, so the places have to be written before they are counted: the
  // write can take a place away as readily as it gives one.
  const placed = await placementsOf(region, [tournamentId]);
  await writeFinalPlaces(region, placed, [tournamentId]);
  await writePlayerHonours(region, accountScope);
  await writeClanHonours(region, clanScope);
}

/** Rebuild every account's and every clan's honours, and every team's finishing
 * place, from the whole archive. */
export async function backfillTournamentWins(
  region: Region,
): Promise<{ accounts: number; clans: number; placedTeams: number }> {
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const teams = tournamentTeamsByRegion[region];
  const teamPlayers = tournamentTeamPlayersByRegion[region];
  const placed = await placementsOf(region);

  await writeFinalPlaces(region, placed, null);

  // Everyone who ever entered, plus anyone holding a count the brackets no
  // longer support, so a run always leaves the column agreeing with them.
  await writePlayerHonours(
    region,
    sql`
      SELECT DISTINCT p.${sql.raw(teamPlayers.accountId.name)} FROM ${teamPlayers} p
      UNION
      SELECT ${sql.raw(players.accountId.name)} FROM ${players}
      WHERE ${sql.raw(players.tournamentWins.name)} > 0
    `,
  );
  await writeClanHonours(
    region,
    sql`
      SELECT DISTINCT tt.${sql.raw(teams.clanId.name)} FROM ${teams} tt
      WHERE tt.${sql.raw(teams.clanId.name)} IS NOT NULL
      UNION
      SELECT ${sql.raw(clans.id.name)} FROM ${clans}
      WHERE ${sql.raw(clans.tournamentWins.name)} > 0
    `,
  );

  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .where(gt(players.tournamentWins, 0));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clans)
    .where(gt(clans.tournamentWins, 0));
  let placedTeams = 0;
  for (const { places } of placed.values()) placedTeams += places.size;
  return { accounts: p?.n ?? 0, clans: c?.n ?? 0, placedTeams };
}
