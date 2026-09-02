import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { storeTeamClans } from "./clans";
import { recordRosterNames } from "./names";
import { recordTournamentWinners } from "./winners";
import {
  tournamentGroupsByRegion,
  tournamentMatchesByRegion,
  tournamentStagesByRegion,
  tournamentStandingsByRegion,
  tournamentTeamPlayersByRegion,
  tournamentTeamsByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import {
  type Region,
  type TournamentSummary,
  TournamentStatus,
} from "@unicum.gg/wargaming";
import { wg } from "@unicum.gg/core/wargaming/client";
import { heldBracket } from "./bracket";
import {
  detailRow,
  detailSet,
  isScheduled,
  summaryRow,
} from "./scheduled";

/**
 * Mirrors Wargaming's tournament system into our own tables.
 *
 * The shape of the work is unusual for this codebase, and it is what the whole
 * module is built around: a tournament that has settled is immutable. Its
 * bracket, its scores and its rosters are finished history, so the archive is
 * written once and then only read. Only the handful of tournaments still open or
 * being played need re-reading, which is why the sweep and the backfill are
 * separate passes rather than one refresh cadence.
 */

/** How the catalogue sweep looks at a tournament: still moving, or settled. */
const LIVE_STATUSES = [
  TournamentStatus.Upcoming,
  TournamentStatus.RegistrationStarted,
  TournamentStatus.RegistrationFinished,
  TournamentStatus.Running,
  TournamentStatus.Finished,
] as const;

/**
 * How long after its end a tournament is treated as settled whatever status it
 * still carries.
 *
 * Wargaming abandons tournaments in a non-terminal state and never comes back to
 * them: Asia holds fourteen sitting at `finished` since 2023 and 2024, and one
 * at `running` three weeks after it ended. `finished` is documented as "results
 * are still being settled", and for a live one that is true and takes hours (EU
 * carries a few, always a day or two old), but past a week it means nobody ever
 * pressed the button and nobody ever will.
 *
 * Reading status alone therefore fails twice over, and in opposite directions:
 * the archive never claims those tournaments, so their page keeps an empty
 * bracket forever, while the live pass re-mirrors a 2023 draw every five minutes
 * for as long as the row exists. A week is generous against the hours the real
 * transition takes, and being wrong costs one extra mirror of a bracket that is
 * already final.
 */
const ABANDONED_AFTER = "7 days";

/**
 * Whether a row belongs to the archive: settled by status, or old enough that
 * its status will not change again.
 *
 * One expression rather than two hand-written `where` clauses, because
 * {@link pickUnmirrored} and {@link pickLive} must stay EXACTLY complementary.
 * Any gap between them either strands a tournament in neither pass or leaves it
 * in both, and each of those is a bug that only shows up weeks later.
 */
function isArchived(table: (typeof tournamentsByRegion)[Region]) {
  return sql`(${table.status} = ${TournamentStatus.Complete}
    OR ${table.endAt} < now() - interval '${sql.raw(ABANDONED_AFTER)}')`;
}

/** Last occurrence of each key wins, matching what an upsert would have left. */
function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(key(row), row);
  return [...byKey.values()];
}

/**
 * Upsert catalogue rows from a sweep.
 *
 * The one subtle line is `detailSyncedAt`. The sweep never reads a bracket, so
 * it cannot stamp the mirror as fresh, but it is the only pass that notices a
 * tournament has moved on, and a status change is exactly when the bracket
 * underneath it changed too: registration closing fixes the field, the first
 * results fill the tree, completion settles it. So a changed status CLEARS the
 * stamp, which puts the tournament back in front of the backfill, and an
 * unchanged one leaves it alone. Without this, a tournament mirrored while it
 * was still being played would keep its half-empty bracket forever.
 */
async function upsertSummaries(
  region: Region,
  tournaments: TournamentSummary[],
): Promise<void> {
  const scheduled = tournaments.filter(isScheduled);
  if (scheduled.length === 0) return;
  const table = tournamentsByRegion[region];
  await db
    .insert(table)
    .values(scheduled.map(summaryRow))
    .onConflictDoUpdate({
      target: table.id,
      set: {
        detailSyncedAt: sql`CASE WHEN ${table.status} IS DISTINCT FROM excluded.status
          THEN NULL ELSE ${table.detailSyncedAt} END`,
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        status: sql`excluded.status`,
        gameModes: sql`excluded.game_modes`,
        tierFrom: sql`excluded.tier_from`,
        tierTo: sql`excluded.tier_to`,
        minPlayersInTeam: sql`excluded.min_players_in_team`,
        maxPlayersInTeam: sql`excluded.max_players_in_team`,
        teamsLimit: sql`excluded.teams_limit`,
        confirmedTeams: sql`excluded.confirmed_teams`,
        startAt: sql`excluded.start_at`,
        endAt: sql`excluded.end_at`,
        registrationFrom: sql`excluded.registration_from`,
        registrationTill: sql`excluded.registration_till`,
        prize: sql`excluded.prize`,
        tags: sql`excluded.tags`,
        logoUrl: sql`excluded.logo_url`,
        isFeatured: sql`excluded.is_featured`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

export type CatalogSweepResult = {
  /** Tournaments the catalogue listed, across every status walked. */
  seen: number;
  /** Of those, the ones whose bracket is not mirrored yet. */
  pending: number;
};

/**
 * Walk the catalogue for a region and record every tournament it lists.
 *
 * `settled` decides how far back it goes. Left off, it walks only the statuses
 * that still move, which is a handful of pages and the right shape for a daily
 * tick. Turned on, it also walks the completed archive, thousands of rows back
 * to 2018, which is a one-time seeding pass.
 */
export async function sweepCatalog(
  region: Region,
  { settled = false }: { settled?: boolean } = {},
): Promise<CatalogSweepResult> {
  const statuses = settled
    ? [...LIVE_STATUSES, TournamentStatus.Complete]
    : LIVE_STATUSES;
  let seen = 0;
  for (const status of statuses) {
    for await (const page of wg.region(region).tournaments.listAll({ status })) {
      await upsertSummaries(region, page);
      seen += page.length;
    }
  }
  return { seen, pending: await countPending(region) };
}

/**
 * Tournaments the backfill still has to mirror.
 *
 * Scoped to the archive, matching {@link pickUnmirrored} exactly, because this
 * number is reported as the backfill's own "remaining": counting every unmirrored
 * row instead made a finished seed report work left that it was never going to
 * claim (a completed Asia pass said "18 left" with nothing left to do, those
 * being the live ones and the ones this pass does not own).
 */
export async function countPending(region: Region): Promise<number> {
  const table = tournamentsByRegion[region];
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(sql`${table.detailSyncedAt} IS NULL AND ${isArchived(table)}`);
  return row?.n ?? 0;
}

/**
 * Ids waiting to be mirrored, newest first so this week's results land before
 * the 2018 archive when both are queued.
 *
 * Settled tournaments only. A tournament still being played has a half-empty
 * bracket and a roster that is still churning, so mirroring it here would just
 * mean mirroring it again on the next tick; {@link pickLive} carries those at
 * their own cadence.
 */
export async function pickUnmirrored(region: Region, limit: number): Promise<number[]> {
  const table = tournamentsByRegion[region];
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(sql`${table.detailSyncedAt} IS NULL AND ${isArchived(table)}`)
    .orderBy(sql`${table.startAt} DESC`)
    .limit(limit);
  return rows.map((r) => Number(r.id));
}

/**
 * Every tournament that has not settled yet: the ones taking registrations and
 * the ones being played right now. A region has a handful at any moment (eight
 * on EU as this was written), so they are re-mirrored whole on each tick rather
 * than rationed, which is what keeps a live bracket moving.
 *
 * That "handful" is the whole reason this pass can be unrationed, and it only
 * stays a handful because {@link isArchived} drops the tournaments Wargaming
 * abandoned mid-status. Keyed on status alone it grew without bound, and every
 * tick re-fetched brackets that had been final for years.
 */
/**
 * Capped like the archive pass, and for the same reason from the other end.
 *
 * `isArchived` retires what Wargaming abandoned, but nothing retires what it
 * has SCHEDULED: a tournament three months out is neither complete nor past its
 * end, so it sits in the live pool being re-mirrored whole every five minutes
 * until it is played. The pool is small today (a dozen on EU, two of them in the
 * future), which is exactly when to bound it rather than after a season's
 * calendar is published at once. Earliest first, so what is in play or about to
 * be is never the part that gets dropped.
 */
const LIVE_BATCH = 40;

export async function pickLive(region: Region): Promise<number[]> {
  const table = tournamentsByRegion[region];
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(sql`NOT ${isArchived(table)}`)
    .orderBy(sql`${table.startAt} ASC`)
    .limit(LIVE_BATCH);
  return rows.map((r) => Number(r.id));
}

export type MirrorResult = {
  tournamentId: number;
  teams: number;
  players: number;
  stages: number;
  matches: number;
  standings: number;
  /** True when the fetch brought no bracket and the mirrored one was kept, so
   * the zero counts above describe this pass rather than what we hold. */
  bracketKept: boolean;
};

/**
 * Mirror one tournament in full: its detail, every registered team with its
 * roster, and the whole bracket with scores and placements.
 *
 * Rosters are replaced rather than merged, because the source has no notion of
 * a deleted row: a team that disbands and a player who leaves simply stop being
 * listed, so an upsert-only pass would keep them forever, and deleting and
 * re-inserting inside one transaction is the only way the mirror can shrink to
 * match.
 *
 * The bracket is the exception, and it is a deliberate break in that rule
 * rather than an oversight to tidy away. Wargaming purges the bracket of a
 * routine tournament within a day or two of it being played, keeping the header
 * and the rosters, so refetching one after the purge returns an empty tree that
 * says nothing about what happened. Replacing on that would delete a finished
 * bracket we hold and write nothing over it, which is the mirror destroying the
 * one thing about these tournaments that exists nowhere else. So an incoming
 * bracket that would SHRINK what we hold is refused: see `keepBracket` below.
 * A bracket therefore cannot be corrected downward, and that is the trade.
 */
export async function mirrorTournament(
  region: Region,
  tournamentId: number,
): Promise<MirrorResult | null> {
  const api = wg.region(region).tournaments;
  const detail = await api.get({ tournamentId });
  // Null rather than a thrown error: an unscheduled tournament is a real state
  // the system reports, not a failure, and the callers count the two apart.
  if (!isScheduled(detail)) return null;
  const teams = await api.allTeams({ tournamentId });
  const stages = await api.stages({ tournamentId });

  // Typed from the resource's own return, so the accumulators are not `any[]`:
  // everything pushed here is written straight to the mirror.
  type Groups = Awaited<ReturnType<typeof api.groups>>;
  type Matches = Awaited<ReturnType<typeof api.matches>>;
  type Standings = Awaited<ReturnType<typeof api.groupStandings>>;
  const groups: (Groups[number] & { stageId: number })[] = [];
  const rawMatches: Matches[number][] = [];
  // The stage rides alongside the row rather than on it: a standing belongs to
  // a group, and the stage is what the mirror keys it under.
  const rawStandings: { stageId: number; row: Standings[number] }[] = [];
  for (const stage of stages) {
    for (const group of await api.groups({ tournamentId, stageId: stage.id })) {
      groups.push(group);
      rawMatches.push(
        ...(await api.matches({ tournamentId, stageId: stage.id, groupId: group.id })),
      );
      for (const row of await api.groupStandings({
        tournamentId,
        stageId: stage.id,
        groupId: group.id,
      })) {
        rawStandings.push({ stageId: stage.id, row });
      }
    }
  }
  // Same primary-key rule as the rosters below: one duplicate in the source
  // would take the whole tournament's insert down with it.
  const matches = dedupe(rawMatches, (m) => m.uuid);
  const standings = dedupe(rawStandings, (s) => `${s.row.groupId}:${s.row.teamId}`);

  // Deduped on the primary key before the insert, not by `onConflictDoUpdate`:
  // Postgres rejects the whole statement when one INSERT carries the same
  // conflict target twice ("cannot affect row a second time"), so a roster
  // listing an account twice would fail the entire tournament rather than one
  // line of it.
  const players = dedupe(
    teams.flatMap((team) =>
      team.players.map((p) => ({
        tournamentId,
        teamId: team.id,
        accountId: p.accountId,
        nickname: p.nickname,
        role: p.role as string,
      })),
    ),
    (p) => `${p.teamId}:${p.accountId}`,
  );

  // Decided before the transaction, because it is a question about what we
  // already hold rather than about what arrived: a fetch that brought no bracket
  // is only news when we had none either.
  //
  // Phrased as "would this shrink what we hold" rather than "did this arrive
  // empty", because the purge upstream is not all-or-nothing. A tournament can
  // come back with its stages intact and the tree under them gone, which an
  // emptiness test reads as a bracket arriving and writes over the real one.
  const held = await heldBracket(region, tournamentId);
  const keepBracket = stages.length < held.stages || matches.length < held.matches;

  await db.transaction(async (tx) => {
    await tx
      .insert(tournamentsByRegion[region])
      .values(detailRow(detail))
      .onConflictDoUpdate({ target: tournamentsByRegion[region].id, set: detailSet() });

    // Rosters are always replaced: the source has no notion of a deleted row, so
    // a team that disbands simply stops being listed and only a delete can make
    // the mirror shrink to match.
    for (const table of [
      tournamentTeamPlayersByRegion[region],
      tournamentTeamsByRegion[region],
    ]) {
      await tx.delete(table).where(sql`${table.tournamentId} = ${tournamentId}`);
    }

    // The bracket is NOT, when the fetch came back without one and we already
    // hold it. Wargaming purges the bracket of a routine tournament within a day
    // or two of it being played, keeping only the header and the rosters, while
    // the handful it features keep theirs indefinitely. Our own passes then walk
    // straight into that: the live pass mirrors a tournament while it is being
    // played, bracket and all, and when it finally settles the status change
    // clears `detail_synced_at` and hands it to the archive pass, which refetches
    // it AFTER the purge. Replacing unconditionally meant deleting a finished
    // bracket we had captured and writing an empty one over it, so the mirror
    // destroyed the very thing it exists to keep, silently, days later, and only
    // for the tournaments nobody else archives either.
    if (!keepBracket) {
      for (const table of [
        tournamentStandingsByRegion[region],
        tournamentMatchesByRegion[region],
        tournamentGroupsByRegion[region],
        tournamentStagesByRegion[region],
      ]) {
        await tx.delete(table).where(sql`${table.tournamentId} = ${tournamentId}`);
      }
    }

    if (!keepBracket && stages.length > 0) {
      await tx.insert(tournamentStagesByRegion[region]).values(
        stages.map((s) => ({
          id: s.id,
          tournamentId,
          title: s.title,
          description: s.description,
          bracketType: s.bracketType as string,
          drawManagement: s.drawManagement as string,
          winnersPerGroup: s.winnersPerGroup,
          groupsCount: s.groupsCount,
          startAt: s.startAt,
          endAt: s.endAt,
        })),
      );
    }
    if (!keepBracket && groups.length > 0) {
      await tx.insert(tournamentGroupsByRegion[region]).values(
        groups.map((g) => ({
          id: g.id,
          tournamentId,
          stageId: g.stageId,
          order: g.order,
          state: g.state as string,
          teamsCount: g.teamsCount,
          winnerRounds: g.winnerRounds,
          looserRounds: g.looserRounds,
        })),
      );
    }
    if (teams.length > 0) {
      await tx.insert(tournamentTeamsByRegion[region]).values(
        teams.map((t) => ({
          id: t.id,
          tournamentId,
          title: t.title,
          status: t.status as string,
          ownerAccountId: t.ownerAccountId || null,
          playersCount: t.playersCount,
          maxPlayers: t.maxPlayers,
          description: t.description,
          isPasswordProtected: t.isPasswordProtected,
          disqualifyReason: t.disqualifyReason,
          updatedAt: new Date(),
        })),
      );
    }
    if (players.length > 0) {
      await tx.insert(tournamentTeamPlayersByRegion[region]).values(players);
    }
    if (!keepBracket && matches.length > 0) {
      await tx.insert(tournamentMatchesByRegion[region]).values(
        matches.map((m) => ({
          uuid: m.uuid,
          tournamentId,
          stageId: m.stageId,
          groupId: m.groupId,
          state: m.state as string,
          round: m.round,
          position: m.position,
          team1Id: m.team1?.id ?? null,
          team2Id: m.team2?.id ?? null,
          winnerTeamId: m.winnerTeamId,
          winsTeam1: m.score?.team1 ?? null,
          winsTeam2: m.score?.team2 ?? null,
          draws: m.score?.draws ?? null,
          maps: m.maps,
          startAt: m.startAt,
          nextMatchForWinner: m.nextMatchForWinner,
          nextMatchForLooser: m.nextMatchForLooser,
        })),
      );
    }
    if (!keepBracket && standings.length > 0) {
      await tx.insert(tournamentStandingsByRegion[region]).values(
        standings.map(({ stageId, row }) => ({
          tournamentId,
          stageId,
          groupId: row.groupId,
          teamId: row.teamId,
          position: row.position,
          seed: row.seed,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          battlesPlayed: row.battlesPlayed,
          tieBreakWins: row.tieBreakWins,
          tieBreakLosses: row.tieBreakLosses,
          points: row.points,
        })),
      );
    }
  });

  // After the transaction, not inside it: the attribution reads the rosters that
  // were just written, and it is a derived convenience rather than part of the
  // mirror. A failure here must not roll back a bracket that arrived intact, so
  // it is logged and the tournament stays mirrored with its teams unattributed
  // until the next pass.
  try {
    await storeTeamClans(region, tournamentId, detail.startAt, detail.teamSize.min);
  } catch (err) {
    console.error(`[tournaments-${region}] ${tournamentId} clan attribution failed:`, err);
  }
  // Rosters carry the nickname each player registered under, frozen at the time,
  // so a mirrored tournament is also a dated observation of names our own rename
  // history could not have seen. Same rule as the attribution above: derived,
  // logged on failure, never allowed to roll back the bracket.
  try {
    await recordRosterNames(region, tournamentId);
  } catch (err) {
    console.error(`[tournaments-${region}] ${tournamentId} name history failed:`, err);
  }
  // The winner's crest. Recomputed from the brackets rather than incremented,
  // because this runs again every time the draw moves, and scoped to everyone
  // who played rather than to the winners, so a bracket corrected upstream
  // takes a win back off as readily as it gave one. Derived and logged like the
  // two above.
  try {
    // After `storeTeamClans` above, in that order: a clan's win is a win by a
    // team attributed to it, so the attribution has to be written before it can
    // be counted.
    await recordTournamentWinners(region, tournamentId);
  } catch (err) {
    console.error(`[tournaments-${region}] ${tournamentId} winners failed:`, err);
  }

  return {
    tournamentId,
    teams: teams.length,
    players: players.length,
    stages: stages.length,
    matches: matches.length,
    standings: standings.length,
    bracketKept: keepBracket,
  };
}

