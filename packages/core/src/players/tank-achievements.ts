import { eq, sql } from "drizzle-orm";
import {
  playerTankAchievementsByRegion,
  type PlayerAchievement,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { cachedInRedis } from "@unicum.gg/core/redis";
import { wg } from "@unicum.gg/core/wargaming/client";
import { getCatalog, joinCatalog } from "./achievements";

/** Medal id → count, for one vehicle. */
type TankCounts = Record<string, number>;
/** Vehicle id → its medals. The shape stored, and the shape WG answers with. */
type AccountTankCounts = Record<string, TankCounts>;

// Only a burst guard, not the source of truth: the first cold view writes the
// whole account to Postgres, so this exists to keep a page opened in five tabs
// from making five identical Wargaming calls before that write lands.
const COLD_TTL_S = 30 * 60;
// A Wargaming failure answers empty rather than wrong; retry it soon.
const COLD_EMPTY_TTL_S = 60;

// How long a page render will wait on the cold fetch before giving up on the
// medals and serving the record without them.
//
// The Wargaming rate limiter is shared with the snapshot pipeline, which keeps
// a region's budget saturated by design, so a call made from a request can
// queue behind it for seconds. That is a fine wait for a background job and a
// terrible one for a page: this section is the last block of a panel whose
// numbers are already in hand. Abandoning the wait does not abandon the fetch:
// it keeps running and still writes, so the medals are simply there on the next
// view rather than never.
const COLD_DEADLINE_MS = 2_000;

// Medals earned per (player, vehicle) move far slower than the counters beside
// them, and the queue that triggers a refresh is fed by page views: without a
// floor, a player whose page is opened all day would cost one extra Wargaming
// call per drain, forever, to learn nothing.
const REFRESH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Every medal this account earned, on every vehicle, in one Wargaming call.
 *
 * `tanks/achievements` is single-account like `tanks/stats`, but it answers for
 * the whole garage at once, which is what makes storing this affordable: one
 * request covers every vehicle a player owns, so the panel's cost is per player
 * rather than per (player, vehicle).
 *
 * Sparse on the way out. WG returns a row per vehicle whether or not anything
 * was earned on it, and a `markOfMastery: 0` for most of them; keeping the
 * zeroes would triple the stored map to say nothing.
 */
async function fetchAccountTankAchievements(
  region: Region,
  accountId: number,
): Promise<AccountTankCounts> {
  const rows = await wg
    .region(region)
    .api.wot.tanks.achievements({ accountId });

  const out: AccountTankCounts = {};
  for (const row of rows) {
    const earned: TankCounts = {};
    for (const [id, n] of Object.entries(row.achievements ?? {})) {
      if (n > 0) earned[id] = n;
    }
    if (Object.keys(earned).length > 0) out[String(row.tank_id)] = earned;
  }
  return out;
}

/**
 * Persist one account's per-vehicle medals.
 *
 * Unconditional, unlike the profile's cabinet, and `updated_at` therefore reads
 * as "last fetched" rather than "last changed". The cabinet writes on every
 * pipeline pass, so it has to skip the unchanged ones to keep its dead tuples
 * proportional to real medal wins; here the age guard below already caps a
 * viewed player at four writes a day, and skipping would leave `updated_at`
 * pinned to the last change, which is exactly the timestamp that guard must not
 * read.
 */
async function recordTankAchievements(
  region: Region,
  playerId: number,
  counts: AccountTankCounts,
): Promise<void> {
  const table = playerTankAchievementsByRegion[region];
  await db
    .insert(table)
    .values({ playerId, counts })
    .onConflictDoUpdate({
      target: table.playerId,
      set: { counts: sql`excluded.counts`, updatedAt: sql`NOW()` },
    });
}

/**
 * One stored vehicle's medals, or null when this player has never been fetched.
 *
 * The distinction matters: a row with no entry for that vehicle is a real
 * answer ("nothing earned on it"), and must not send the reader to Wargaming
 * for a map it already knows is empty. Only the absence of the row does.
 *
 * Extracts the one vehicle in SQL rather than reading the map back: the row is
 * a few kilobytes covering a whole garage, and the panel wants one key of it.
 */
async function readStoredTank(
  region: Region,
  playerId: number,
  tankId: number,
): Promise<TankCounts | null> {
  const table = playerTankAchievementsByRegion[region];
  const [row] = await db
    .select({
      counts: sql<TankCounts | null>`${table.counts} -> ${String(tankId)}`,
    })
    .from(table)
    .where(eq(table.playerId, playerId))
    .limit(1);
  return row ? (row.counts ?? {}) : null;
}

/**
 * This player's medals on this vehicle.
 *
 * Postgres first, so the panel renders on the server from a single indexed
 * lookup. The live fetch is the cold path only, and it writes the whole account
 * back, so a player pays it once for their entire garage no matter which
 * vehicle was opened first.
 */
async function getTankCounts(
  region: Region,
  playerId: number,
  accountId: number,
  tankId: number,
): Promise<TankCounts | null> {
  const stored = await readStoredTank(region, playerId, tankId);
  if (stored) return stored;

  const pending = backfillAccount(region, playerId, accountId);
  // Detached from the race below, so abandoning the wait never surfaces as an
  // unhandled rejection.
  pending.catch(() => {});

  const fetched = await Promise.race([pending, expireAfter(COLD_DEADLINE_MS)]);
  // Null, not empty: the fetch outran the render, and "we do not know yet" must
  // not reach the panel as "nothing earned on this tank".
  if (!fetched) return null;
  return fetched[String(tankId)] ?? {};
}

/** Resolves to null once the render has waited long enough. Unrefs its timer so
 * a pending deadline never holds the process open at shutdown. */
function expireAfter(ms: number): Promise<null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
  });
}

/** Fetch this account's whole garage and store it, for a player we hold none of.
 * Runs to completion even when the render that started it has given up. */
async function backfillAccount(
  region: Region,
  playerId: number,
  accountId: number,
): Promise<AccountTankCounts> {
  const fetched = await cachedInRedis<AccountTankCounts>(
    `player:tank-achievements:${region}:${accountId}`,
    (c) => (Object.keys(c).length > 0 ? COLD_TTL_S : COLD_EMPTY_TTL_S),
    () =>
      fetchAccountTankAchievements(region, accountId).catch((err) => {
        console.error(
          `[tank-achievements] fetch failed (${region}/${accountId}):`,
          err,
        );
        return {};
      }),
  );

  // Only persist a real answer: an empty map is what a failed call looks like,
  // and storing it would pin an empty Awards panel on every vehicle this player
  // owns until something else overwrote it.
  if (Object.keys(fetched).length > 0) {
    await recordTankAchievements(region, playerId, fetched).catch((err) =>
      console.error(
        `[tank-achievements] backfill write failed (${region}):`,
        err,
      ),
    );
  }
  return fetched;
}

/**
 * Refresh a player's stored medals, if they have any stored.
 *
 * Called from the on-demand refresh queue, which is fed by page views, so the
 * one extra Wargaming request per drained player is only ever paid for players
 * someone is actually looking at. The `has a row` guard is what keeps it off
 * the snapshot pipeline's budget: the 2M accounts nobody has opened a vehicle
 * panel on never cost a call.
 *
 * The age guard bounds the other end. Every view of a player enqueues them, so
 * a popular account drains repeatedly through the day; without a floor each of
 * those drains would spend a Wargaming request to re-read medals that had not
 * moved.
 */
export async function refreshStoredTankAchievements(
  region: Region,
  playerId: number,
  accountId: number,
): Promise<void> {
  const table = playerTankAchievementsByRegion[region];
  const [existing] = await db
    .select({ updatedAt: table.updatedAt })
    .from(table)
    .where(eq(table.playerId, playerId))
    .limit(1);
  if (!existing) return;
  if (Date.now() - existing.updatedAt.getTime() < REFRESH_MAX_AGE_MS) return;

  const counts = await fetchAccountTankAchievements(region, accountId);
  if (Object.keys(counts).length > 0) {
    await recordTankAchievements(region, playerId, counts);
  }
}

/**
 * The medals this player earned on this vehicle, joined onto the catalogue: the
 * game's per-vehicle "Awards" tab.
 *
 * Earned only, unlike the profile's cabinet which serves the catalogue whole.
 * "What is still missing" is a question about a player, not about one of their
 * vehicles, and 505 unearned entries would dwarf the record they sit under.
 *
 * Ordered the way Wargaming orders the cabinet (section, then rank within it),
 * so a player who knows the game finds their medals in the order they know.
 *
 * Null when we hold nothing for this player yet and the fetch did not come back
 * in time. The caller renders no section at all for that, rather than an empty
 * one: it heals on the next view, and saying "no medal earned" to someone who
 * has a wall of them is worse than saying nothing.
 */
export async function getTankAwards(
  region: Region,
  playerId: number,
  accountId: number,
  tankId: number,
): Promise<PlayerAchievement[] | null> {
  const [catalog, counts] = await Promise.all([
    getCatalog(region),
    getTankCounts(region, playerId, accountId, tankId),
  ]);
  if (!counts) return null;
  return joinCatalog(catalog.entries, counts).achievements.filter(
    (a) => a.count > 0,
  );
}
