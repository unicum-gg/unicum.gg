import { specFingerprint, type ProfileSource } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getTankOrigins } from "./based-on";
import { getTankDataset, type TankDatasetRow } from "./dataset";

/** A vehicle that is this one under another name, as the page offers it. */
export type TankTwin = {
  tankId: number;
  slug: string;
  name: string;
  /** Players the nightly pass ranked on it, which is what the switch shows. */
  players: number;
};

/**
 * Every hop of the client's "made from" chain, so a style of a style lands on
 * the vehicle underneath all of them. Bounded, because the chain is data and a
 * cycle in it would otherwise never end.
 */
function rootOf(tag: string, origins: Record<string, string>): string {
  let at = tag;
  for (let hop = 0; hop < 4; hop++) {
    const from = origins[at];
    if (!from || from === at) break;
    at = from;
  }
  return at;
}

function fingerprintOf(row: TankDatasetRow): string | null {
  return row.specs ? specFingerprint(row.specs as ProfileSource) : null;
}

/**
 * The vehicles that are this one wearing another name: the Dream Chaser is the
 * SDP wz 66 Grom, sold as a premium of its own with its own id.
 *
 * Wargaming keeps a separate record for each id, so a player's battles on one
 * never count on the other, and a twin bought by three players has a page with
 * three players on it. The page offers to read the twins together, and this is
 * what decides who they are.
 *
 * **Both conditions, never one.** The client has to declare one made from the
 * other (directly or through the same vehicle), AND every characteristic has to
 * be equal. The declaration alone links a reissue that was rebalanced (an
 * `IGR` copy with less hit points is made from the original and plays
 * differently), and equal numbers alone link two unrelated vehicles that happen
 * to measure the same. Together they say "the same machine", which is the only
 * claim the merged figures can carry.
 *
 * Only twins with server stats are returned: one nobody plays adds nothing to
 * read together, and the switch would offer an empty half.
 */
export async function getTankTwins(
  region: Region,
  tankId: number,
): Promise<TankTwin[]> {
  const [dataset, origins] = await Promise.all([
    getTankDataset(region),
    getTankOrigins(),
  ]);
  const self = dataset.find((row) => row.identity.tankId === tankId);
  if (!self || self.identity.isCommonTest) return [];
  const print = fingerprintOf(self);
  if (!print) return [];
  const root = rootOf(self.identity.tag, origins);

  return dataset
    .filter(
      (row) =>
        row.identity.tankId !== tankId &&
        !row.identity.isCommonTest &&
        row.stats != null &&
        rootOf(row.identity.tag, origins) === root &&
        fingerprintOf(row) === print,
    )
    .map((row) => ({
      tankId: row.identity.tankId,
      slug: row.identity.slug,
      name: row.identity.name,
      players: row.stats!.players,
    }))
    .sort((a, b) => b.players - a.players);
}
