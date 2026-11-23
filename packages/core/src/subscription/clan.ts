import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  account,
  clansByRegion,
  playersByRegion,
  subscription,
  supportPayment,
  supportProfile,
  wgIdentityFromAccountKey,
} from "@unicum.gg/shared";
import { REGIONS, isRegion, type Region } from "@unicum.gg/wargaming";

// Kept beside `ACTIVE_STATUSES` in `./index`, which it must match: a clan's
// badge says the same thing a player's does, "is funding the site right now".
const ACTIVE_STATUSES = ["active", "trialing"];

/** A clan as the support surfaces name it. */
export type SupportClan = {
  region: Region;
  id: number;
  tag: string;
  color: string;
};

/**
 * The Wargaming account behind a user, read off their Wargaming `account` row
 * (`<region>-<accountId>`). Null for a user whose link is missing.
 */
async function wgIdentityOfUser(userId: string) {
  const [row] = await db
    .select({ key: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "wargaming")))
    .limit(1);
  return wgIdentityFromAccountKey(row?.key);
}

/** The account id half of a Wargaming account key, as SQL, for joining the
 * `account` row onto a region's player table. */
const accountIdOf = sql`split_part(${account.accountId}, '-', 2)::bigint`;
const accountRegionOf = sql`split_part(${account.accountId}, '-', 1)`;

async function clanById(region: Region, clanId: number): Promise<SupportClan | null> {
  const clans = clansByRegion[region];
  const [row] = await db
    .select({ id: clans.id, tag: clans.tag, color: clans.color })
    .from(clans)
    .where(and(eq(clans.id, clanId), eq(clans.isDisbanded, false)))
    .limit(1);
  return row ? { region, id: Number(row.id), tag: row.tag, color: row.color } : null;
}

/**
 * The clan the user belongs to right now, as our player row knows it. Null for
 * a clanless player, or one we hold no row for. This is the only clan a
 * supporter can count their support for, which is what keeps the badge on a
 * clan page honest: nobody can lend it to a clan they are not in.
 */
export async function getCurrentClanOfUser(userId: string): Promise<SupportClan | null> {
  const wg = await wgIdentityOfUser(userId);
  if (!wg) return null;
  const players = playersByRegion[wg.region];
  const [row] = await db
    .select({ clanId: players.clanId })
    .from(players)
    .where(eq(players.accountId, wg.accountId))
    .limit(1);
  return row?.clanId ? clanById(wg.region, Number(row.clanId)) : null;
}

/**
 * The clan the user counts their support for, or null. A choice made for a clan
 * they have since left reads as null, the same way every public read ignores it.
 */
export async function getSupportClanOfUser(userId: string): Promise<SupportClan | null> {
  const [profile] = await db
    .select({ region: supportProfile.clanRegion, clanId: supportProfile.clanId })
    .from(supportProfile)
    .where(eq(supportProfile.userId, userId))
    .limit(1);
  if (!profile?.clanId || !profile.region || !isRegion(profile.region)) return null;
  const current = await getCurrentClanOfUser(userId);
  return current && current.region === profile.region && current.id === Number(profile.clanId)
    ? current
    : null;
}

/**
 * Counts the user's support for their current clan, or for nobody. Returns the
 * clan it now counts for. Asking to count it while clanless clears the choice
 * rather than failing, since the result is the same: it counts for nobody.
 */
export async function setSupportClan(
  userId: string,
  dedicate: boolean,
): Promise<SupportClan | null> {
  const clan = dedicate ? await getCurrentClanOfUser(userId) : null;
  const values = { clanRegion: clan?.region ?? null, clanId: clan?.id ?? null };
  await db
    .insert(supportProfile)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: supportProfile.userId, set: values });
  return clan;
}

/**
 * How many of a clan's current members hold an active monthly pledge counted
 * for it. Anonymous supporters are counted, since a number names nobody.
 */
export async function countClanSupporters(region: Region, clanId: number): Promise<number> {
  const players = playersByRegion[region];
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${subscription.userId})` })
    .from(subscription)
    .innerJoin(supportProfile, eq(supportProfile.userId, subscription.userId))
    .innerJoin(
      account,
      and(eq(account.userId, subscription.userId), eq(account.providerId, "wargaming")),
    )
    .innerJoin(
      players,
      and(eq(players.accountId, accountIdOf), eq(players.clanId, clanId)),
    )
    .where(
      and(
        inArray(subscription.status, ACTIVE_STATUSES),
        eq(supportProfile.clanRegion, region),
        eq(supportProfile.clanId, clanId),
        eq(accountRegionOf, region),
      ),
    );
  return Number(row?.n ?? 0);
}

/** One row of the clans board. Like the supporters board, no amount. */
export type ClanPodiumEntry = SupportClan & {
  rank: number;
  /** Members who have given something and count it for the clan. */
  supporters: number;
};

/**
 * The clans board: every clan whose current members have counted their support
 * for it, ranked by what those members have given in total, monthly pledges and
 * one-off donations alike (the same ledger the supporters board reads). Ties go
 * to the clan whose support arrived first. A member who leaves takes their
 * share with them, which is the point: the board ranks clans as they stand.
 */
export async function getClansPodium(limit = 10): Promise<ClanPodiumEntry[]> {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => {
      const players = playersByRegion[region];
      const clans = clansByRegion[region];
      const net = sql<number>`sum(${supportPayment.amountCents} - ${supportPayment.amountRefundedCents})`;
      const rows = await db
        .select({
          id: clans.id,
          tag: clans.tag,
          color: clans.color,
          total: net,
          supporters: sql<number>`count(distinct ${supportPayment.userId})`,
          first: sql<Date>`min(${supportPayment.createdAt})`,
        })
        .from(supportPayment)
        .innerJoin(supportProfile, eq(supportProfile.userId, supportPayment.userId))
        .innerJoin(
          account,
          and(eq(account.userId, supportPayment.userId), eq(account.providerId, "wargaming")),
        )
        .innerJoin(
          players,
          and(
            eq(players.accountId, accountIdOf),
            eq(players.clanId, supportProfile.clanId),
          ),
        )
        .innerJoin(clans, eq(clans.id, supportProfile.clanId))
        .where(
          and(
            eq(supportProfile.clanRegion, region),
            eq(accountRegionOf, region),
            eq(clans.isDisbanded, false),
          ),
        )
        .groupBy(clans.id, clans.tag, clans.color)
        .having(sql`${net} > 0`);
      return rows.map((r) => ({ region, ...r }));
    }),
  );
  return perRegion
    .flat()
    .sort(
      (a, b) =>
        Number(b.total) - Number(a.total) ||
        new Date(a.first).getTime() - new Date(b.first).getTime(),
    )
    .slice(0, limit)
    .map((r, i) => ({
      rank: i + 1,
      region: r.region,
      id: Number(r.id),
      tag: r.tag,
      color: r.color,
      supporters: Number(r.supporters),
    }));
}
