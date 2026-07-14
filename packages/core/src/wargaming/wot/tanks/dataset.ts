import type { TankSpec } from "@unicum.gg/core/db/schema";
import { type MoeValues, getTankMoeByRegion } from "@unicum.gg/core/moe";
import { type MomValues, getTankMomByRegion } from "@unicum.gg/core/mom";
import type { Region } from "@unicum.gg/wargaming";
import { getAllTankStats, type TankServerStats } from "../players/top/by-tank";
import type { VehicleMeta } from "./meta";
import { listTanks } from "./resolve";
import { getAllTankSpecs } from "./specs";

/** A vehicle's identity: `tankId`/`slug` plus its full `VehicleMeta`, spread so
 * every meta field flows through automatically (no field can be forgotten). */
export type TankRowIdentity = { tankId: number; slug: string } & VehicleMeta;

/**
 * One row of the per-region tank dataset: identity joined to server performance,
 * specifications + economics (both from `specs`), and Mark of Excellence /
 * Mastery thresholds.
 *
 * Single source of truth for the /tanks page AND the /tanks API datasets — both
 * consume `getTankDataset` in-process, so adding a field here is a one-place
 * change that surfaces in the page and every API endpoint at once.
 */
export type TankDatasetRow = {
  identity: TankRowIdentity;
  stats: TankServerStats | null;
  specs: TankSpec | null;
  mastery: MomValues | null;
  moe: MoeValues | null;
};

export async function getTankDataset(
  region: Region,
): Promise<TankDatasetRow[]> {
  const [tanks, statsByTank, specsByTank, momByTank, moeByTank] =
    await Promise.all([
      listTanks(region),
      getAllTankStats(region),
      getAllTankSpecs(),
      getTankMomByRegion(region),
      getTankMoeByRegion(region),
    ]);
  return tanks
    // Only real tiers 1-10(11); drop catalogue entries with no meaningful tier.
    .filter((t) => t.meta.tier > 0 && t.meta.name.length > 0)
    .map((t) => ({
      identity: { tankId: t.tankId, slug: t.slug, ...t.meta },
      stats: statsByTank.get(t.tankId) ?? null,
      specs: specsByTank.get(t.tankId) ?? null,
      mastery: momByTank.get(t.tankId) ?? null,
      moe: moeByTank.get(t.tankId) ?? null,
    }));
}

/** One tank's dataset row by slug, or null if the region has no such vehicle.
 * Reuses `getTankDataset` (its per-source loaders are individually cached), so
 * the per-tank API endpoints share the same single source as the list. */
export async function getTankRow(
  region: Region,
  slug: string,
): Promise<TankDatasetRow | null> {
  const dataset = await getTankDataset(region);
  return dataset.find((r) => r.identity.slug === slug) ?? null;
}
