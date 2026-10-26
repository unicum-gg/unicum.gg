import type { MapTankStats } from "@unicum.gg/shared";
import type { FilterableTank } from "@/hooks/use-tank-filters";

/**
 * One vehicle on the map, flattened into the shape every vehicle table on the
 * site filters: `useTankFilters` reads tier, nation, class, role and the
 * premium and reward flags off the row itself, so the catalogue's filter bar
 * works here unchanged.
 */
export type MapTankRow = FilterableTank &
  Pick<MapTankStats, "tankId" | "stats" | "rating" | "baselineRating"> & {
    tier: number;
    nation: string;
    type: string;
    slug: string;
    tag: string;
    shortName: string;
  };

/**
 * The vehicles a page can draw and link. One the catalogue does not know, or
 * holds no slug for (a hidden vehicle), still counts in every figure above and
 * is left out of this list only, since it has no page to lead to.
 */
export function mapTankRows(tanks: MapTankStats[]): MapTankRow[] {
  return tanks.flatMap((tank) => {
    const vehicle = tank.vehicle;
    if (!vehicle?.slug) return [];
    return [
      {
        tankId: tank.tankId,
        stats: tank.stats,
        rating: tank.rating,
        baselineRating: tank.baselineRating,
        slug: vehicle.slug,
        tag: vehicle.tag,
        name: vehicle.name,
        shortName: vehicle.shortName,
        tier: vehicle.tier,
        nation: vehicle.nation,
        type: vehicle.type,
        role: vehicle.role,
        isPremium: vehicle.isPremium,
        isReward: vehicle.isReward,
      },
    ];
  });
}
