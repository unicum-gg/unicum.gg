import { and, eq, notInArray } from "drizzle-orm";
import {
  GARAGE_SOURCE,
  playerGarageByRegion,
  type GarageSource,
} from "@unicum.gg/shared";
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

/**
 * Replace one source's reading of an account's garage.
 *
 * Only its own rows: the delete is scoped to the source, so a token read
 * cannot remove what the mod reported, or the other way round. That is what
 * `GARAGE_SOURCE` is for, and it is not a precaution. Neither source contains
 * the other (80 vehicles the mod sees are absent from Wargaming entirely, 2
 * that Wargaming calls held have no row in the mod's sweep), so a replace
 * across both would delete real vehicles every time either one wrote.
 */
async function writePlayerGarage(
  region: Region,
  accountId: number,
  tankIds: number[],
  source: GarageSource,
): Promise<void> {
  const table = playerGarageByRegion[region];
  const verifiedAt = new Date();
  await db.transaction(async (tx) => {
    // A vehicle this source no longer reports leaves its rows, so one
    // source's reading is a replacement rather than an accumulation.
    await tx
      .delete(table)
      .where(
        and(
          eq(table.accountId, accountId),
          eq(table.source, source),
          notInArray(table.tankId, tankIds),
        ),
      );
    // Restamp every vehicle, so the newest stamp of this source is the age of
    // its whole reading rather than of its most recent purchase.
    await tx
      .insert(table)
      .values(
        tankIds.map((tankId) => ({ accountId, tankId, source, verifiedAt })),
      )
      .onConflictDoUpdate({
        target: [table.accountId, table.tankId, table.source],
        set: { verifiedAt },
      });
  });
}

/**
 * Store the inventory the mod swept out of the player's own client.
 *
 * The only reading that can see a vehicle bought and never driven, which on a
 * real account is about 40% of the garage and the half nothing else here can
 * reach.
 *
 * An empty list is refused for the reason the token read refuses one: the game
 * hands every player a starter tank, so nobody holds nothing, and writing it
 * would wipe a good reading. The mod already declines to send an empty sweep;
 * this is the second lock on that door.
 */
export async function recordModGarage(
  region: Region,
  accountId: number,
  tankIds: number[],
): Promise<boolean> {
  const owned = [...new Set(tankIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  if (owned.length === 0) return false;
  await writePlayerGarage(region, accountId, owned, GARAGE_SOURCE.mod);
  return true;
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

  await writePlayerGarage(
    params.region,
    params.accountId,
    read.owned,
    GARAGE_SOURCE.token,
  );
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

  // Every source's rows, which is the union by construction: a vehicle both
  // of them hold is two rows and one entry in the set, and the stamp reported
  // is the freshest of them. No ranking, because neither source contains the
  // other; see `GARAGE_SOURCE`.
  let verifiedAt = rows[0].verifiedAt;
  const tankIds = new Set<number>();
  for (const row of rows) {
    tankIds.add(row.tankId);
    if (row.verifiedAt > verifiedAt) verifiedAt = row.verifiedAt;
  }
  return { tankIds, verifiedAt };
}
