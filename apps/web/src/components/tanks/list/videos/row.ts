import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";

/**
 * A battle on the community index.
 *
 * Carries the tank's own catalogue fields on top of the battle, which is what
 * lets the index reuse the tank list's filter bar: `useTankFilters` is generic
 * over anything shaped like a vehicle, so a row that names its tier, nation,
 * class and role filters exactly like a vehicle does.
 *
 * All of them are nullable, because a competitive tactic is not about a vehicle:
 * it is filed under the map it was fought on. Such a row simply fails every
 * vehicle filter, which is the correct answer to "show me the tier X mediums".
 */
export type CommunityBattle = Omit<TankVideoCardData, "tier"> & {
  tankName: string | null;
  tankSlug: string | null;
  tankShortName: string | null;
  tankTag: string | null;
  /** The vehicle's tier, under the name `useTankFilters` reads. The battle's own
   * tier keeps its own name below: a skirmish is fought at a tier of its own,
   * and the filter bar means the vehicle's. */
  tier: number | null;
  battleTier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  /** `useTankFilters` reads these two by name. */
  name: string;
  shortName: string;
};

/** The endpoint's rows, given the two aliases the filter hook expects.
 *
 * `tier` is the vehicle's, not the battle's. The endpoint separates them
 * (`vehicleTier` and `tier`) because a skirmish is fought at a tier of its own,
 * and the filter bar means the first. Spreading the row without this line kept
 * compiling and quietly filtered by the wrong number. */
export function toCommunityBattles(
  videos: (TankVideoCardData & Record<string, unknown>)[],
): CommunityBattle[] {
  return videos.map((v) => ({
    ...(v as unknown as CommunityBattle),
    tier: (v.vehicleTier as number | null) ?? null,
    battleTier: (v.tier as number | null) ?? null,
    name: String(v.tankName ?? ""),
    shortName: String(v.tankShortName ?? ""),
  }));
}
