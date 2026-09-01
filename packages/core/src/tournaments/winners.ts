import { and, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import {
  clansByRegion,
  finalPlacements,
  playersByRegion,
  tournamentGroupsByRegion,
  tournamentStagesByRegion,
  tournamentStandingsByRegion,
  tournamentTeamPlayersByRegion,
  tournamentTeamsByRegion,
  tournamentsByRegion,
  type PlacementStage,
} from "@unicum.gg/shared";
import { TournamentStatus, type Region } from "@unicum.gg/wargaming";
import { db } from "../db";

/** A tournament a team actually won, and what the win is worth naming. */
type Win = {
  teamId: number;
  title: string;
  startAt: Date;
  isFeatured: boolean;
};

/**
 * Who won a tournament, read by the SAME rule the bracket page draws.
 *
 * `finalPlacements` lives in shared for exactly this: the two used to run on
 * separate copies and disagreed. A third-place match is filed as its own
 * single-group stage, so taking the last stage at face value crowned the team
 * that won the match FOR THIRD (EU 5000015153 credited Piranhas while the page
 * showed ENIGMA). The shared rule identifies a decider by its shape, not by its
 * title, and uses it to split a tie rather than to replace the ranking.
 *
 * Only settled tournaments count. This runs on every live mirror, five minutes
 * apart, and a round robin in play has a leader sitting at position 1: without
 * the gate a crest appeared for a tournament nobody had won yet, then moved to
 * whoever led next.
 */
async function winnersOf(
  region: Region,
  tournamentIds?: number[],
): Promise<Win[]> {
  const tournaments = tournamentsByRegion[region];
  const stages = tournamentStagesByRegion[region];
  const groups = tournamentGroupsByRegion[region];
  const standings = tournamentStandingsByRegion[region];

  // Settled the same way the archive pass reads it (`isArchived`): Wargaming
  // abandons tournaments in a non-terminal state and never returns to them, so
  // a status alone would leave a 2023 draw forever uncrowned.
  const settled = sql`(${tournaments.status} = ${TournamentStatus.Complete}
    OR ${tournaments.endAt} < now() - interval '7 days')`;

  const rows = await db
    .select({
      tournamentId: tournaments.id,
      title: tournaments.title,
      startAt: tournaments.startAt,
      isFeatured: tournaments.isFeatured,
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
  type Meta = { title: string; startAt: Date; isFeatured: boolean };
  const meta = new Map<number, Meta>();
  const byTournament = new Map<
    number,
    Map<number, { startAt: Date | null; groups: Map<number, PlacementStage["groups"][number]["standings"]> }>
  >();
  for (const row of rows) {
    const tid = Number(row.tournamentId);
    if (!meta.has(tid)) {
      meta.set(tid, {
        title: row.title,
        startAt: row.startAt,
        isFeatured: row.isFeatured,
      });
    }
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

  const out: Win[] = [];
  for (const [tid, stageMap] of byTournament) {
    const ordered: PlacementStage[] = [...stageMap.entries()]
      .sort(([aId, a], [bId, b]) => {
        const at = a.startAt?.getTime() ?? 0;
        const bt = b.startAt?.getTime() ?? 0;
        return at === bt ? aId - bId : at - bt;
      })
      .map(([, stage]) => ({ groups: [...stage.groups.values()].map((standings) => ({ standings })) }));
    const first = finalPlacements(ordered).find((p) => p.position === 1);
    const m = meta.get(tid);
    if (first && m) out.push({ teamId: first.teamId, ...m });
  }
  return out;
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
  wins: Win[],
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
  if (wins.length === 0) return;
  await db.execute(sql`
    WITH won(team_id, title, start_at, is_featured) AS (VALUES ${winValues(wins)}),
    tally AS (
      SELECT p.${sql.raw(teamPlayers.accountId.name)} AS account_id,
             count(*)::int AS wins,
             count(*) FILTER (WHERE w.is_featured)::int AS featured,
             (array_agg(w.title ORDER BY w.is_featured DESC, w.start_at DESC))[1] AS best_title,
             (array_agg(w.start_at ORDER BY w.is_featured DESC, w.start_at DESC))[1] AS best_at
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
  wins: Win[],
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
  if (wins.length === 0) return;
  await db.execute(sql`
    WITH won(team_id, title, start_at, is_featured) AS (VALUES ${winValues(wins)}),
    tally AS (
      SELECT tt.${sql.raw(teams.clanId.name)} AS clan_id,
             count(*)::int AS wins,
             count(*) FILTER (WHERE w.is_featured)::int AS featured,
             (array_agg(w.title ORDER BY w.is_featured DESC, w.start_at DESC))[1] AS best_title,
             (array_agg(w.start_at ORDER BY w.is_featured DESC, w.start_at DESC))[1] AS best_at
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

/** The wins as a `VALUES` list. Bound, not interpolated: a tournament title is
 * Wargaming's text and goes nowhere near the statement's own syntax. */
function winValues(wins: Win[]) {
  return sql.join(
    wins.map(
      (w) =>
        sql`(${w.teamId}::bigint, ${w.title}::text, ${w.startAt.toISOString()}::timestamptz, ${w.isFeatured}::boolean)`,
    ),
    sql`, `,
  );
}

/**
 * Refresh the honours of everyone a tournament involved, players and clans.
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
  // Every win those accounts and clans hold, not just this tournament's, since
  // the write replaces the counter rather than adding to it.
  const wins = await winnersOf(region);
  await writePlayerHonours(region, accountScope, wins);
  await writeClanHonours(region, clanScope, wins);
}

/** Rebuild every account's and every clan's honours from the whole archive. */
export async function backfillTournamentWins(
  region: Region,
): Promise<{ accounts: number; clans: number }> {
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const teams = tournamentTeamsByRegion[region];
  const teamPlayers = tournamentTeamPlayersByRegion[region];
  const wins = await winnersOf(region);

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
    wins,
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
    wins,
  );

  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .where(gt(players.tournamentWins, 0));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clans)
    .where(gt(clans.tournamentWins, 0));
  return { accounts: p?.n ?? 0, clans: c?.n ?? 0 };
}
