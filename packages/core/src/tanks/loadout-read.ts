import { eq, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import { playersByRegion, type StoredPlayerLoadout } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getTankLoadout, isLoadoutHidden } from "@unicum.gg/core/tanks/loadouts";

/**
 * The read path for one player's loadout on one vehicle, as the page asks for
 * it: by nickname and by slug, rather than by the ids the table is keyed on.
 *
 * Kept apart from `loadouts.ts`, which is the write path and the storage, so
 * the mod's upload does not drag the slug catalogue in behind it.
 */

/**
 * How this player has set this vehicle up, or null.
 *
 * Null covers four different things on purpose, and the endpoint does not
 * distinguish them: an unknown player, an unknown vehicle, a player who does
 * not run the mod, and a player who asked not to be shown. The first three are
 * indistinguishable to a reader anyway (nothing to draw is nothing to draw),
 * and telling the fourth apart would publish the very thing it asks us not to.
 */
export async function getPlayerTankLoadout(
  region: Region,
  nickname: string,
  slug: string,
): Promise<StoredPlayerLoadout | null> {
  const identity = await getTankBySlug(region, slug);
  if (!identity) return null;

  const players = playersByRegion[region];
  const [player] = await db
    .select({ accountId: players.accountId })
    .from(players)
    .where(eq(sql`LOWER(${players.nickname})`, nickname.toLowerCase()))
    .limit(1);
  if (!player) return null;

  if (await isLoadoutHidden(`${region}-${player.accountId}`)) return null;
  return getTankLoadout(region, player.accountId, identity.tankId);
}
