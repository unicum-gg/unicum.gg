import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type ClanMember,
  clanMembersByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { clanChannel, publish } from "@unicum.gg/core/live/pubsub";
import { clanRoleOrder, type Region } from "@unicum.gg/wargaming";
import {
  type ClanMemberPeriodStats,
  type ClanMemberStats,
  type ClanRole,
  type PortalClanMember,
  getClanMembersStats,
} from "@unicum.gg/core/clans/members";
import { enqueueClanRefreshBackground } from "@unicum.gg/core/clans/refresh-queue";

type PlayerRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  pr: number | null;
  wtr: number | null;
  wn730d: number | null;
  wn830d: number | null;
  wnx30d: number | null;
  battles30d: number | null;
};

function memberStatsFromRow(
  row: ClanMember,
  ratings: PlayerRatings | null,
): ClanMemberStats {
  return {
    accountId: Number(row.accountId),
    name: row.name,
    role: row.role as ClanRole,
    roleLocalized: row.roleLocalized,
    // Ranked off the role name rather than the stored `role_rank`, which is a
    // denormalisation of exactly this and therefore freezes whatever hierarchy
    // was current when the clan was last refreshed. A full backfill sweep takes
    // over two months, so a correction to the role list would otherwise take
    // that long to reach every roster.
    roleRank: clanRoleOrder(row.role),
    daysInClan: row.daysInClan,
    lastBattleTime: row.lastBattleTime,
    personalRating: row.personalRating,
    overall:
      row.overallBattles !== null &&
      row.overallWinsPct !== null &&
      row.overallDamagePerBattle !== null &&
      row.overallExpPerBattle !== null &&
      row.overallFragsPerBattle !== null &&
      row.overallBattlesPerDay !== null
        ? {
            battles: row.overallBattles,
            winsPercentage: row.overallWinsPct,
            damagePerBattle: row.overallDamagePerBattle,
            expPerBattle: row.overallExpPerBattle,
            fragsPerBattle: row.overallFragsPerBattle,
            battlesPerDay: row.overallBattlesPerDay,
          }
        : null,
    d28:
      row.d28Battles !== null &&
      row.d28WinsPct !== null &&
      row.d28DamagePerBattle !== null &&
      row.d28ExpPerBattle !== null &&
      row.d28FragsPerBattle !== null &&
      row.d28BattlesPerDay !== null
        ? {
            battles: row.d28Battles,
            winsPercentage: row.d28WinsPct,
            damagePerBattle: row.d28DamagePerBattle,
            expPerBattle: row.d28ExpPerBattle,
            fragsPerBattle: row.d28FragsPerBattle,
            battlesPerDay: row.d28BattlesPerDay,
          }
        : null,
    wn7: ratings?.wn7 ?? null,
    wn8: ratings?.wn8 ?? null,
    wnx: ratings?.wnx ?? null,
    pr: ratings?.pr ?? null,
    wtr: ratings?.wtr ?? null,
    wn730d: ratings?.wn730d ?? null,
    wn830d: ratings?.wn830d ?? null,
    wnx30d: ratings?.wnx30d ?? null,
    battles30d: ratings?.battles30d ?? null,
  };
}

export type ClanMembersCached = {
  members: ClanMemberStats[];
  fromDb: boolean;
  refreshing: boolean;
};

/** Per-member figures the WG API roster does not carry, sourced from our own
 * player data: lifetime `overall` (latest snapshot), `personalRating` (that
 * snapshot's global rating) and `lastBattleTime` (players row). */
type MemberSnapshotData = {
  overall: ClanMemberPeriodStats;
  personalRating: number | null;
  lastBattleTime: Date | null;
};

async function periodStatsFromSnapshotsForAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, MemberSnapshotData>> {
  if (accountIds.length === 0) return new Map();
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];

  const playerRows = await db
    .select({
      id: players.id,
      accountId: players.accountId,
      createdAt: players.createdAt,
      lastBattleAt: players.lastBattleAt,
    })
    .from(players)
    .where(inArray(players.accountId, accountIds));
  if (playerRows.length === 0) return new Map();

  const playerIds = playerRows.map((r) => r.id);
  const snapshotRows = await db
    .select({
      playerId: playerSnapshots.playerId,
      takenAt: playerSnapshots.takenAt,
      battles: playerSnapshots.battles,
      wins: playerSnapshots.wins,
      damageDealt: playerSnapshots.damageDealt,
      frags: playerSnapshots.frags,
      xp: playerSnapshots.xp,
      globalRating: playerSnapshots.globalRating,
    })
    .from(playerSnapshots)
    .where(inArray(playerSnapshots.playerId, playerIds))
    .orderBy(desc(playerSnapshots.takenAt));

  const latestByPlayer = new Map<number, (typeof snapshotRows)[number]>();
  for (const s of snapshotRows) {
    if (!latestByPlayer.has(s.playerId)) latestByPlayer.set(s.playerId, s);
  }

  const out = new Map<number, MemberSnapshotData>();
  const now = Date.now();
  for (const p of playerRows) {
    const s = latestByPlayer.get(p.id);
    if (!s || s.battles <= 0) continue;
    const created = p.createdAt instanceof Date ? p.createdAt.getTime() : null;
    const days = created
      ? Math.max(1, Math.floor((now - created) / 86_400_000))
      : null;
    out.set(Number(p.accountId), {
      overall: {
        battles: s.battles,
        winsPercentage: (s.wins / s.battles) * 100,
        damagePerBattle: Number(s.damageDealt) / s.battles,
        expPerBattle: Number(s.xp) / s.battles,
        fragsPerBattle: s.frags / s.battles,
        battlesPerDay: days ? s.battles / days : 0,
      },
      personalRating: s.globalRating ?? null,
      lastBattleTime: p.lastBattleAt ?? null,
    });
  }
  return out;
}

async function enrichMissingOverall(
  region: Region,
  members: ClanMemberStats[],
): Promise<ClanMemberStats[]> {
  const missing = members.filter((m) => m.overall === null);
  if (missing.length === 0) return members;
  const byAccount = await periodStatsFromSnapshotsForAccounts(
    region,
    missing.map((m) => m.accountId),
  );
  if (byAccount.size === 0) return members;
  return members.map((m) =>
    m.overall === null && byAccount.has(m.accountId)
      ? { ...m, overall: byAccount.get(m.accountId)?.overall ?? null }
      : m,
  );
}

/**
 * The roster we hold, mapped and enriched. `null` when we hold none, which the
 * two callers answer differently: the read path queues a fetch, the refresh path
 * keeps what it has.
 *
 * Side-effect free on purpose. The queueing lives in the caller, so the refresh
 * path can read the stored roster without enqueueing the clan it is in the
 * middle of refreshing.
 */
async function readStoredMembers(
  region: Region,
  clanId: number,
): Promise<ClanMemberStats[] | null> {
  const clanMembers = clanMembersByRegion[region];
  const players = playersByRegion[region];
  // LEFT JOIN players: ratings live on the players row (updated by
  // snapshot-cron whenever a fresh tank snapshot lands), so a member whose
  // player hasn't been snapshotted yet gets null ratings — render as "—".
  const rows = await db
    .select({
      member: clanMembers,
      wn7: players.wn7,
      wn8: players.wn8,
      wnx: players.wnx,
      pr: players.pr,
      wtr: players.wtr,
      wn730d: players.wn730d,
      wn830d: players.wn830d,
      wnx30d: players.wnx30d,
      battles30d: players.battles30d,
    })
    .from(clanMembers)
    .leftJoin(players, eq(clanMembers.accountId, players.accountId))
    .where(eq(clanMembers.clanId, clanId));

  if (rows.length === 0) return null;

  return enrichMissingOverall(
    region,
    rows.map((r) =>
      memberStatsFromRow(r.member, {
        wn7: r.wn7,
        wn8: r.wn8,
        wnx: r.wnx,
        pr: r.pr,
        wtr: r.wtr,
        wn730d: r.wn730d,
        wn830d: r.wn830d,
        wnx30d: r.wnx30d,
        battles30d: r.battles30d,
      }),
    ),
  );
}

export async function getClanMembersCached(
  region: Region,
  clanId: number,
  /** Set for a clan that has ended, so the stale-while-revalidate below is not
   * promised on its behalf. Nothing can ever fill its roster: WG serves no
   * members for it, and the queue refuses it outright (see `liveOnly`), so the
   * page would show a refresh beacon spinning to its ceiling on every single
   * visit, and pay a queue round trip each time to be refused again. */
  isDisbanded = false,
): Promise<ClanMembersCached> {
  const stored = await readStoredMembers(region, clanId);
  if (stored) {
    // No refresh from here: see the note in repository/events.ts. `/enqueue`
    // (real browsers only) and clan-backfill-cron own freshness, and this line
    // used to fire a portal call on every crawler render.
    return { members: stored, fromDb: true, refreshing: false };
  }

  // Stale-while-revalidate: render the clan page with an empty members
  // table right away and fire the WG fetch in the background. LiveSync's
  // SSE triggers router.refresh() once the members land. Avoids the
  // 5-30s wait when G-Core throttles EU and the WG members endpoint
  // hangs on first-visit clans.
  // Queued, not fetched. This is the first-ever view of a clan, so there is
  // nothing to serve and the page renders empty until LiveSync pushes the
  // members in — which means nobody is waiting on this call, and it has no
  // business holding a request open against a 1-rps portal.
  // An ended clan whose roster we never captured has none to show, and saying
  // "refreshing" would be a promise nothing can keep.
  if (isDisbanded) return { members: [], fromDb: true, refreshing: false };

  enqueueClanRefreshBackground(region, [clanId], { priority: 10 });
  return { members: [], fromDb: false, refreshing: true };
}

export async function refreshClanMembers(
  region: Region,
  clanId: number,
  prefetchedRoster?: PortalClanMember[],
): Promise<ClanMemberStats[]> {
  const clanMembers = clanMembersByRegion[region];
  // Roster (names, roles, join dates) comes from the batchable WG API; the
  // per-member lifetime figures the API omits are backfilled from our own
  // player snapshots so we never touch the 1 RPS clan portal for members. The
  // cron passes `prefetchedRoster` from a single batched `clans/info` call; the
  // on-demand path fetches this one clan's roster on its own.
  const roster =
    prefetchedRoster ?? (await getClanMembersStats(region, clanId));
  const snapshotData = await periodStatsFromSnapshotsForAccounts(
    region,
    roster.map((m) => m.accountId),
  );
  const members = roster.map((m) => {
    const d = snapshotData.get(m.accountId);
    return d
      ? {
          ...m,
          overall: d.overall,
          personalRating: d.personalRating,
          lastBattleTime: d.lastBattleTime,
        }
      : m;
  });
  // A roster never legitimately empties. WG disbands a clan that loses its last
  // member, so an empty answer means either the clan has ended (its `members`
  // come back null) or WG is contradicting itself: it reports `members_count: 1`
  // with an empty list on 63 live EU clans, measured. Either way the roster we
  // hold is the better answer AND one we can never fetch again, so a
  // replacement that would shrink it to nothing is refused rather than applied.
  // This is the rule the tournament mirror's bracket already follows, for the
  // same reason, and its absence is why 446 disbanded EU clans had their last
  // roster deleted by the first visitor who landed on their page.
  if (members.length === 0) {
    // Published even though nothing changed: a browser that asked for this
    // roster is sitting on LiveSync waiting for it, and the refusal is the
    // answer. Without it the page spins until its own ceiling.
    publish(clanChannel(region, clanId), { kind: "members" });
    return (await readStoredMembers(region, clanId)) ?? [];
  }
  await db.transaction(async (tx) => {
    await tx.delete(clanMembers).where(eq(clanMembers.clanId, clanId));
    await tx.insert(clanMembers).values(
      members.map((m) => ({
        clanId,
        accountId: m.accountId,
        name: m.name,
        role: m.role,
        roleLocalized: m.roleLocalized,
        roleRank: m.roleRank,
        daysInClan: m.daysInClan,
        lastBattleTime: m.lastBattleTime,
        personalRating: m.personalRating,
        overallBattles: m.overall?.battles ?? null,
        overallWinsPct: m.overall?.winsPercentage ?? null,
        overallDamagePerBattle: m.overall?.damagePerBattle ?? null,
        overallExpPerBattle: m.overall?.expPerBattle ?? null,
        overallFragsPerBattle: m.overall?.fragsPerBattle ?? null,
        overallBattlesPerDay: m.overall?.battlesPerDay ?? null,
        d28Battles: m.d28?.battles ?? null,
        d28WinsPct: m.d28?.winsPercentage ?? null,
        d28DamagePerBattle: m.d28?.damagePerBattle ?? null,
        d28ExpPerBattle: m.d28?.expPerBattle ?? null,
        d28FragsPerBattle: m.d28?.fragsPerBattle ?? null,
        d28BattlesPerDay: m.d28?.battlesPerDay ?? null,
        refreshedAt: new Date(),
      })),
    );
  });
  discoverPlayersBackground(
    region,
    members.map((m) => ({ accountId: m.accountId, nickname: m.name })),
  );
  publish(clanChannel(region, clanId), { kind: "members" });
  // Ratings are computed from tank snapshots elsewhere (the cron path is the
  // single source of truth); the freshly-fetched portal members carry none, so
  // surface them as null to match the enriched ClanMemberStats shape.
  return members.map((m) => ({
    ...m,
    wn7: null,
    wn8: null,
    wnx: null,
    pr: null,
    wtr: null,
    wn730d: null,
    wn830d: null,
    wnx30d: null,
    battles30d: null,
  }));
}
