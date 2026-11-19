import type { Region } from "@unicum.gg/wargaming";
import { readReplay } from "@unicum.gg/shared";
import { storeLoadoutsFromContainer } from "@unicum.gg/core/battles/loadouts";
import { storePositionsFromContainer } from "@unicum.gg/core/maps/positions";

/**
 * Decode the file once and store what it says, swallowing any fault.
 *
 * Two things come out of it: the loadouts the recording carries, and where
 * the recorder's team set up and dealt its damage from, for the map's
 * minimap. The decode is the expensive half -- a decryption and an inflate
 * over about a megabyte -- and it happens here rather than on the read path
 * for exactly that reason, once for both. A
 * recording from a client this cannot read simply yields nothing, which is a
 * battle with no loadout and no positions rather than an error: coverage is a
 * thing to measure, not to fail on.
 *
 * Each write is guarded on its own, so a fault in one never costs the other.
 * The reading itself lives in `core` because the backfills do the same work on
 * the same files, and the two must not drift.
 */
export async function writeDerived(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  bytes: Uint8Array,
): Promise<void> {
  let container;
  try {
    container = await readReplay(bytes);
  } catch (error) {
    console.error(
      `[replay-derived] ${region}/${arenaUniqueId}: unreadable`,
      error,
    );
    return;
  }
  try {
    await storeLoadoutsFromContainer(region, arenaUniqueId, startedAt, container);
  } catch (error) {
    console.error(
      `[replay-derived] ${region}/${arenaUniqueId}: loadout not stored`,
      error,
    );
  }
  try {
    await storePositionsFromContainer(region, arenaUniqueId, startedAt, container);
  } catch (error) {
    console.error(
      `[replay-derived] ${region}/${arenaUniqueId}: positions not stored`,
      error,
    );
  }
}

