import { eq } from "drizzle-orm";
import { loadoutPrivacy } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Whether this player shows their battle list to themselves alone.
 *
 * Read on every request for a player's battles, so it is a primary-key lookup
 * on a table holding one row per player who ever made a privacy choice.
 */
export async function isBattlesHidden(
  wargamingAccount: string,
): Promise<boolean> {
  const [row] = await db
    .select({ battlesHidden: loadoutPrivacy.battlesHidden })
    .from(loadoutPrivacy)
    .where(eq(loadoutPrivacy.wargamingAccount, wargamingAccount))
    .limit(1);
  return row?.battlesHidden ?? false;
}

/**
 * Record this player's choice about showing their battle list.
 *
 * A first row written for this reason must not hide the loadouts as a side
 * effect, which the column's own default would do, so `hidden` is named on the
 * insert and left alone on the update.
 */
export async function setBattlesHidden(
  wargamingAccount: string,
  userId: string,
  battlesHidden: boolean,
): Promise<void> {
  await db
    .insert(loadoutPrivacy)
    .values({
      wargamingAccount,
      userId,
      hidden: false,
      battlesHidden,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: loadoutPrivacy.wargamingAccount,
      set: { battlesHidden, userId, updatedAt: new Date() },
    });
}
