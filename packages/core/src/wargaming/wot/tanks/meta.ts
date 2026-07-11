import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

// Pure, db-free vehicle metadata shape and helpers. Kept apart from
// `encyclopedia.ts` (which imports `db`) so client components can pull
// `computeAvgTier` / `VehicleMeta` into the browser bundle without dragging
// the Postgres driver (and its `fs`/`os` node built-ins) along with them.
export type VehicleMeta = {
  tier: number;
  type: string;
  nation: string;
  name: string;
  shortName: string;
  tag: string;
  isPremium: boolean;
  isReward: boolean;
  role: string | null;
  contourIcon: string | null;
  bigIcon: string | null;
};

// Battle-weighted average tier across a set of tanks. Tanks with no
// encyclopedia entry or zero battles are ignored; returns null when nothing
// qualifies.
export function computeAvgTier(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
): number | null {
  let weighted = 0;
  let total = 0;
  for (const tank of tanks) {
    const meta = encyclopedia[String(tank.tank_id)];
    const battles = tank.all?.battles ?? 0;
    if (!meta || battles <= 0) continue;
    weighted += meta.tier * battles;
    total += battles;
  }
  return total > 0 ? weighted / total : null;
}
