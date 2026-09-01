import { eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  playerClanHistoryByRegion,
  tournamentTeamPlayersByRegion,
  tournamentTeamsByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Which clan a tournament team belongs to.
 *
 * Wargaming's tournament system knows nothing about clans: a team is a name its
 * captain typed and a list of account ids. But the accounts are ours, so the
 * clan behind a team is recoverable, and it is what turns a tournament record
 * into something a clan page can carry.
 *
 * `tag` and `color` are the clan's CURRENT ones, so the badge links somewhere
 * that resolves, while `id` is what the membership was matched on. A clan we do
 * not track keeps the tag its roster carried at the time and renders unlinked.
 */
export type TeamClan = {
  clanId: number;
  clanTag: string;
  clanName: string | null;
  clanColor: string | null;
  clanEmblem: string | null;
  /** How many of the roster were in it, and out of how many the format fields.
   * Published so a page can say how firm the attribution is. */
  members: number;
};

/**
 * The share of a team that must sit in one clan for the team to be that clan's.
 *
 * Measured against the FORMAT (a 15v15's fifteen), not against the roster we
 * mirrored. Rosters are frequently partial: a registration that never completed
 * leaves one account against a fifteen-player format, and one account is always
 * 100% of itself, so a roster-relative share hands those phantom entries a clan
 * with total confidence. Against the format they fall below the bar and are
 * correctly left unattributed.
 */
export const CLAN_SHARE = 0.25;

/**
 * Resolve every team's clan for one tournament, AS OF THE DAY IT WAS PLAYED.
 *
 * Read from the clan-membership history (`joinedAt`/`leftAt`) rather than from
 * each player's current clan, because the archive goes back to 2018 and players
 * move: taking today's clan would credit a 2019 result to whoever happens to
 * hold those players now. History covers 99.9% of the tournament accounts we
 * track, so this is the accurate reading rather than the theoretical one.
 *
 * One query for the whole tournament, not one per team.
 */
export async function resolveTeamClans(
  region: Region,
  tournamentId: number,
  playedAt: Date,
  minPlayersInTeam: number,
): Promise<Map<number, TeamClan>> {
  const rosters = tournamentTeamPlayersByRegion[region];
  const history = playerClanHistoryByRegion[region];
  const clans = clansByRegion[region];

  // A stint is either one of the past ones or the open current one, and the
  // membership held on the day when it had started and had not yet ended.
  // Bound as an ISO string with an explicit cast: the driver rejects a Date in
  // a raw statement ("Received an instance of Date").
  const at = playedAt.toISOString();
  const rows = await db.execute<{
    team_id: string;
    clan_id: string;
    members: number;
    tag: string | null;
    name: string | null;
    color: string | null;
    emblem: string | null;
    historic_tag: string | null;
  }>(sql`
    WITH roster AS (
      SELECT ${rosters.teamId} AS team_id, ${rosters.accountId} AS account_id
      FROM ${rosters}
      WHERE ${rosters.tournamentId} = ${tournamentId}
    ),
    stint AS (
      SELECT r.team_id,
             (s->'clan'->>'id')::bigint AS clan_id,
             s->'clan'->>'tag' AS historic_tag
      FROM roster r
      JOIN ${history} h ON h.${sql.raw(history.accountId.name)} = r.account_id
      CROSS JOIN LATERAL (
        SELECT e FROM jsonb_array_elements(
          coalesce(h.${sql.raw(history.data.name)}->'pastStints', '[]'::jsonb)
        ) e
        UNION ALL
        SELECT h.${sql.raw(history.data.name)}->'currentStint'
        WHERE h.${sql.raw(history.data.name)}->'currentStint' <> 'null'::jsonb
      ) x(s)
      WHERE (s->>'joinedAt')::timestamptz <= ${at}::timestamptz
        AND (s->>'leftAt' IS NULL
             OR (s->>'leftAt')::timestamptz >= ${at}::timestamptz)
    )
    SELECT stint.team_id::text AS team_id,
           stint.clan_id::text AS clan_id,
           count(*)::int AS members,
           max(stint.historic_tag) AS historic_tag,
           max(c.${sql.raw(clans.tag.name)}) AS tag,
           max(c.${sql.raw(clans.name.name)}) AS name,
           max(c.${sql.raw(clans.color.name)}) AS color,
           max(c.${sql.raw(clans.emblem.name)}) AS emblem
    FROM stint
    LEFT JOIN ${clans} c ON c.${sql.raw(clans.id.name)} = stint.clan_id
    GROUP BY stint.team_id, stint.clan_id
  `);

  // Against the format, floored at one so a 1v1 stays attributable.
  const needed = Math.max(1, Math.ceil(minPlayersInTeam * CLAN_SHARE));
  const best = new Map<number, { clan: TeamClan; tied: boolean }>();
  for (const row of rows) {
    const members = Number(row.members);
    if (members < needed) continue;
    const teamId = Number(row.team_id);
    const current = best.get(teamId);
    if (current && current.clan.members > members) continue;
    // A team split evenly between two clans belongs to neither: picking one
    // would be picking whichever the database returned first.
    if (current && current.clan.members === members) {
      best.set(teamId, { ...current, tied: true });
      continue;
    }
    best.set(teamId, {
      tied: false,
      clan: {
        clanId: Number(row.clan_id),
        clanTag: row.tag ?? row.historic_tag ?? "",
        clanName: row.name,
        clanColor: row.color,
        clanEmblem: row.emblem,
        members,
      },
    });
  }

  const out = new Map<number, TeamClan>();
  for (const [teamId, { clan, tied }] of best) {
    if (!tied && clan.clanTag) out.set(teamId, clan);
  }
  return out;
}

/**
 * Compute and store every team's clan for one tournament.
 *
 * Written onto the team row rather than derived on read: the clan is recovered
 * by matching each roster account against its membership history, and a clan
 * page asking "which tournaments did we enter" cannot walk the whole archive's
 * rosters on every view.
 *
 * The stamp is set for EVERY team, including the ones with no clan, so a team
 * that legitimately has none is not re-examined by every later pass.
 */
export async function storeTeamClans(
  region: Region,
  tournamentId: number,
  playedAt: Date,
  minPlayersInTeam: number,
): Promise<number> {
  const teams = tournamentTeamsByRegion[region];
  const resolved = await resolveTeamClans(
    region,
    tournamentId,
    playedAt,
    minPlayersInTeam,
  );

  await db.transaction(async (tx) => {
    // Clear first, so a team that loses its attribution (a roster corrected, a
    // membership backfilled) does not keep a stale clan.
    await tx
      .update(teams)
      .set({ clanId: null, clanMembers: null, clanResolvedAt: new Date() })
      .where(eq(teams.tournamentId, tournamentId));
    for (const [teamId, clan] of resolved) {
      await tx
        .update(teams)
        .set({ clanId: clan.clanId, clanMembers: clan.members })
        .where(eq(teams.id, teamId));
    }
  });
  return resolved.size;
}

/**
 * Attribute the teams of every tournament that has not been looked at yet.
 *
 * Claims by the stamp rather than by `clanId IS NULL`, since "no clan" is a real
 * answer that must not be retried forever. Safe to interrupt and re-run: each
 * tournament is stamped as it completes.
 *
 * Purely local work, no Wargaming call, so it is bounded by the database rather
 * than by a rate limit.
 */
/** How long to wait out a database that went away mid-pass. */
const RETRY_PAUSE_MS = 5_000;
/** Failures in a row that mean the database is down, not the rows. */
const CONSECUTIVE_FAILURE_LIMIT = 25;

export async function backfillTeamClans(
  region: Region,
  { limit, onProgress }: {
    limit?: number;
    onProgress?: (done: number, attributed: number) => void;
  } = {},
): Promise<{ tournaments: number; attributed: number; failed: number }> {
  const tournaments = tournamentsByRegion[region];
  const teams = tournamentTeamsByRegion[region];
  let done = 0;
  let attributed = 0;
  let failed = 0;
  // Failures since the last success. The stop below is about a database that
  // went away, so it has to count a RUN of them: a cumulative total never
  // resets and would eventually trip on a healthy pass.
  let sinceSuccess = 0;
  // Tournaments this run could not attribute. A claim reads what is unstamped,
  // and a row that always throws is never stamped, so without this the pass
  // re-claims the same handful forever instead of moving on.
  const skip = new Set<number>();

  for (;;) {
    if (limit !== undefined && done >= limit) break;
    const pending = await db
      .selectDistinct({
        id: tournaments.id,
        startAt: tournaments.startAt,
        minPlayersInTeam: tournaments.minPlayersInTeam,
      })
      .from(teams)
      .innerJoin(tournaments, eq(tournaments.id, teams.tournamentId))
      .where(
        skip.size === 0
          ? sql`${teams.clanResolvedAt} IS NULL`
          : sql`${teams.clanResolvedAt} IS NULL AND ${tournaments.id} NOT IN ${sql.raw(`(${[...skip].join(",")})`)}`,
      )
      .orderBy(sql`${tournaments.startAt} DESC`)
      .limit(25);
    if (pending.length === 0) break;

    for (const row of pending) {
      if (limit !== undefined && done >= limit) break;
      try {
        attributed += await storeTeamClans(
          region,
          Number(row.id),
          row.startAt,
          row.minPlayersInTeam,
        );
        sinceSuccess = 0;
      } catch (err) {
        // A dropped connection must not cost the whole pass. The tournament
        // stays unstamped, so it is simply reclaimed on the next round, and the
        // pause gives a restarting database time to come back rather than
        // burning through the remaining claim against a closed socket.
        failed += 1;
        sinceSuccess += 1;
        skip.add(Number(row.id));
        console.error(`[team-clans-${region}] ${row.id} failed:`, err);
        await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
      }
      done += 1;
      if (done % 25 === 0) onProgress?.(done, attributed);
    }
    // A run of failures means the database is gone rather than the data being
    // bad, and spinning on it would fill a log with the same error. Measured
    // since the last success, and NOT gated on the run having attributed
    // nothing: one attribution early on used to disable the stop for good.
    if (sinceSuccess >= CONSECUTIVE_FAILURE_LIMIT) {
      throw new Error(
        `[team-clans-${region}] ${sinceSuccess} consecutive failures, stopping`,
      );
    }
  }
  return { tournaments: done, attributed, failed };
}

/**
 * Each account's clan ON A GIVEN DAY, for the roster table.
 *
 * The same history read as {@link resolveTeamClans}, per account rather than
 * folded into a team. It is what lets a roster line say "(as OldName [OLDTAG])"
 * truthfully: Wargaming records the nickname a player carried at the time (the
 * mismatch against today's name runs 17% on 2018 tournaments and 2% on this
 * year's, which only happens if the name is frozen), and pairing that with
 * today's clan tag would put a name from 2018 next to a clan joined in 2024.
 */
export async function resolveAccountClans(
  region: Region,
  accountIds: readonly number[],
  playedAt: Date,
): Promise<Map<number, { tag: string; color: string | null }>> {
  const out = new Map<number, { tag: string; color: string | null }>();
  if (accountIds.length === 0) return out;
  const history = playerClanHistoryByRegion[region];
  const at = playedAt.toISOString();

  const rows = await db.execute<{
    account_id: string;
    tag: string | null;
    color: string | null;
  }>(sql`
    SELECT h.${sql.raw(history.accountId.name)}::text AS account_id,
           (s->'clan'->>'tag') AS tag,
           (s->'clan'->>'color') AS color
    FROM ${history} h
    CROSS JOIN LATERAL (
      SELECT e FROM jsonb_array_elements(
        coalesce(h.${sql.raw(history.data.name)}->'pastStints', '[]'::jsonb)
      ) e
      UNION ALL
      SELECT h.${sql.raw(history.data.name)}->'currentStint'
      WHERE h.${sql.raw(history.data.name)}->'currentStint' <> 'null'::jsonb
    ) x(s)
    WHERE h.${sql.raw(history.accountId.name)} = ANY(${sql.raw(`ARRAY[${accountIds.join(",")}]::bigint[]`)})
      AND (s->>'joinedAt')::timestamptz <= ${at}::timestamptz
      AND (s->>'leftAt' IS NULL
           OR (s->>'leftAt')::timestamptz >= ${at}::timestamptz)
  `);

  for (const row of rows) {
    if (row.tag) out.set(Number(row.account_id), { tag: row.tag, color: row.color });
  }
  return out;
}

/**
 * The attribution as STORED, for the reads that only need to display it.
 *
 * Migration 0094 put `clan_id` on the team row precisely so a page view would
 * not walk the rosters, and the tournament detail was walking them anyway:
 * `resolveTeamClans` re-runs a `jsonb_array_elements` lateral over the clan
 * history for every rostered account, on every tournament page, every team page
 * and both OG cards. This is an indexed join on the clan id instead.
 *
 * It can also only agree with the clan's own Tournaments tab, which reads the
 * same column: recomputing on one side and reading on the other let the two
 * attribute the same team to different clans once membership was backfilled.
 */
export async function readTeamClans(
  region: Region,
  tournamentId: number,
): Promise<Map<number, TeamClan>> {
  const teams = tournamentTeamsByRegion[region];
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      teamId: teams.id,
      members: teams.clanMembers,
      clanId: clans.id,
      clanTag: clans.tag,
      clanName: clans.name,
      clanColor: clans.color,
      clanEmblem: clans.emblem,
    })
    .from(teams)
    .innerJoin(clans, eq(clans.id, teams.clanId))
    .where(eq(teams.tournamentId, tournamentId));
  const out = new Map<number, TeamClan>();
  for (const row of rows) {
    out.set(Number(row.teamId), {
      clanId: Number(row.clanId),
      clanTag: row.clanTag,
      clanName: row.clanName,
      clanColor: row.clanColor,
      clanEmblem: row.clanEmblem,
      members: row.members ?? 0,
    });
  }
  return out;
}
