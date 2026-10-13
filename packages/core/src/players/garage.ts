import { and, eq, notInArray } from "drizzle-orm";
import { playerGarageByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getWargamingAccessToken } from "@unicum.gg/core/auth/wargaming-token";
import { wg } from "@unicum.gg/core/wargaming/client";
import type { Region } from "@unicum.gg/wargaming";

/** An account's verified garage: what it holds, and when that was read. */
export type PlayerGarage = {
  tankIds: Set<number>;
  verifiedAt: Date;
};

export type GarageRefreshResult =
  | { ok: true; owned: number; sold: number; unplayed: number }
  | { ok: false; reason: "no_account" | "expired" | "unauthenticated" | "empty" };

/**
 * Read an account's garage from Wargaming with the owner's own access token.
 *
 * The whole list is fetched and filtered here rather than through WG's own
 * `in_garage=1`, because that filter is silently ignored for a caller whose
 * token does not cover the account: it answers 200 with every vehicle the
 * account ever had, which is indistinguishable from a genuinely large garage
 * and would store sixty sold tanks as owned. The field itself cannot lie the
 * same way, so the rule is read from the rows: a `false` anywhere proves the
 * token was applied.
 *
 * A vehicle owned but never driven comes back with `in_garage: null` rather
 * than `true` (WG has no stats record to hang the flag on), and WG's own filter
 * counts it as held, so `null` is kept. That is the half of the garage nothing
 * else on the site can see.
 */
async function fetchGarageTankIds(
  region: Region,
  accountId: number,
  accessToken: string,
): Promise<{ owned: number[]; sold: number; unplayed: number } | null> {
  const rows = await wg
    .region(region)
    .api.wot.tanks.stats({
      accountId,
      accessToken,
      fields: ["tank_id", "in_garage", "all.battles"] as const,
    });

  // Not one decided flag means the token was not applied to this account. Fail
  // towards "we know nothing" rather than towards "everything is owned".
  if (!rows.some((r) => r.in_garage !== null)) return null;

  const owned: number[] = [];
  let sold = 0;
  let unplayed = 0;
  for (const row of rows) {
    if (row.in_garage === false) {
      sold += 1;
      continue;
    }
    owned.push(row.tank_id);
    if ((row.all?.battles ?? 0) === 0) unplayed += 1;
  }
  return { owned, sold, unplayed };
}

/** Replace an account's stored garage with what the token just reported. */
async function writePlayerGarage(
  region: Region,
  accountId: number,
  tankIds: number[],
): Promise<void> {
  const table = playerGarageByRegion[region];
  const verifiedAt = new Date();
  await db.transaction(async (tx) => {
    // A vehicle sold since the last reading leaves the table, so the stored
    // garage is a replacement rather than an accumulation.
    await tx
      .delete(table)
      .where(
        and(eq(table.accountId, accountId), notInArray(table.tankId, tankIds)),
      );
    // Restamp every vehicle, so the newest stamp on the account is the age of
    // the whole reading rather than of its most recent purchase.
    await tx
      .insert(table)
      .values(tankIds.map((tankId) => ({ accountId, tankId, verifiedAt })))
      .onConflictDoUpdate({
        target: [table.accountId, table.tankId],
        set: { verifiedAt },
      });
  });
}

/**
 * Read one account's garage with a token already in hand, and store it.
 *
 * Separate from `refreshPlayerGarage` so the sign-in callback can use the token
 * WG just handed back rather than decrypting the copy it is in the middle of
 * writing.
 */
export async function syncPlayerGarage(params: {
  region: Region;
  accountId: number;
  accessToken: string;
}): Promise<GarageRefreshResult> {
  const read = await fetchGarageTankIds(
    params.region,
    params.accountId,
    params.accessToken,
  ).catch(() => null);
  if (!read) return { ok: false, reason: "unauthenticated" };
  // An account that holds nothing cannot exist (the game hands every player a
  // starter tank), so an empty answer is WG having a bad minute. Writing it
  // would wipe a good garage.
  if (read.owned.length === 0) return { ok: false, reason: "empty" };

  await writePlayerGarage(params.region, params.accountId, read.owned);
  return {
    ok: true,
    owned: read.owned.length,
    sold: read.sold,
    unplayed: read.unplayed,
  };
}

/**
 * Read the garage of the account a signed-in user owns, and store it.
 *
 * Keyed on the Better Auth user because the token is: a player can only ever
 * verify their own garage. What is stored is keyed on the WG account instead,
 * so every visitor of that profile reads it afterwards.
 */
export async function refreshPlayerGarage(
  userId: string,
): Promise<GarageRefreshResult> {
  const token = await getWargamingAccessToken(userId);
  if (!token.ok) return { ok: false, reason: token.reason };
  return syncPlayerGarage({
    region: token.region,
    accountId: token.accountId,
    accessToken: token.token,
  });
}

/**
 * The stored garage of an account, or null when nobody has ever signed in with
 * it. Null is "unverified", never "empty".
 */
export async function loadPlayerGarage(
  region: Region,
  accountId: number,
): Promise<PlayerGarage | null> {
  const table = playerGarageByRegion[region];
  const rows = await db
    .select({ tankId: table.tankId, verifiedAt: table.verifiedAt })
    .from(table)
    .where(eq(table.accountId, accountId));
  if (rows.length === 0) return null;

  let verifiedAt = rows[0].verifiedAt;
  const tankIds = new Set<number>();
  for (const row of rows) {
    tankIds.add(row.tankId);
    if (row.verifiedAt > verifiedAt) verifiedAt = row.verifiedAt;
  }
  return { tankIds, verifiedAt };
}
