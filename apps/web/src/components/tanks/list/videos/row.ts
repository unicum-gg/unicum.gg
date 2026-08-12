import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";

/**
 * A battle on the community index.
 *
 * Carries the tank's own catalogue fields on top of the battle, which is what
 * lets the index reuse the tank list's filter bar: `useTankFilters` is generic
 * over anything shaped like a vehicle, so a row that names its tier, nation,
 * class and role filters exactly like a vehicle does.
 */
export type CommunityBattle = TankVideoCardData & {
  tankName: string;
  tankSlug: string;
  tankShortName: string;
  tankTag: string;
  tier: number;
  nation: string;
  type: string;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  /** `useTankFilters` reads these two by name. */
  name: string;
  shortName: string;
};

/** The endpoint's rows, given the two aliases the filter hook expects. */
export function toCommunityBattles(
  videos: (TankVideoCardData & Record<string, unknown>)[],
): CommunityBattle[] {
  return videos.map((v) => ({
    ...(v as CommunityBattle),
    name: String(v.tankName ?? ""),
    shortName: String(v.tankShortName ?? ""),
  }));
}
