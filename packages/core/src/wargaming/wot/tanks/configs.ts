import { ModuleType, Region, type WotSrcSpec } from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { getTankModules, type ModuleStats, type TankModuleNode } from "./modules";

/** The WG module ids mounted in one configuration, one per slot (null when the
 * tank has no module of that class, e.g. a casemate TD's turret). */
export type TankConfigModules = {
  gun: number | null;
  turret: number | null;
  engine: number | null;
  chassis: number | null;
  radio: number | null;
};

/** One selectable module combination and its full derived characteristics. The
 * `specs` shape is a `WotSrcSpec`, which is the `tank_specs` row shape (minus
 * `tag`), so the tank page renders it through the same `TankCharacteristics`
 * component as the stock row. */
export type TankConfig = { modules: TankConfigModules; specs: WotSrcSpec };

type Slot = keyof TankConfigModules;

const SLOT_BY_TYPE: Partial<Record<ModuleType, Slot>> = {
  [ModuleType.Gun]: "gun",
  [ModuleType.Turret]: "turret",
  [ModuleType.Engine]: "engine",
  [ModuleType.Chassis]: "chassis",
  [ModuleType.Radio]: "radio",
};

// The bridge between wot-src (which derives the full stat block per combination
// but keys modules by opaque wot-src names) and WG (which owns the module ids
// the UI selects by) is a per-slot signature: a small vector of raw stats both
// sources compute identically. We match each wot-src config's slot to the WG
// module whose reference stats sit closest. Gun handling (reload/aim/dispersion)
// can be shared across a tank's guns (they differ only in clip size), so guns
// are matched on their default (AP) shell's damage + penetration instead.
function nodeSignature(stats: ModuleStats | null): number[] | null {
  if (!stats) return null;
  switch (stats.kind) {
    case "gun":
      return [stats.shells[0]?.damage ?? 0, stats.shells[0]?.penetration ?? 0];
    case "turret":
      return [stats.traverseSpeed, stats.viewRange];
    case "engine":
      return [stats.power];
    case "chassis":
      return [stats.traverseSpeed];
    case "radio":
      return [stats.signalRange];
  }
}

function specSignature(slot: Slot, spec: WotSrcSpec): number[] {
  switch (slot) {
    case "gun":
      return [spec.damage ?? 0, spec.penetration ?? 0];
    case "turret":
      return [spec.turretTraverse ?? 0, spec.viewRange ?? 0];
    case "engine":
      return [spec.enginePower ?? 0];
    case "chassis":
      return [spec.hullTraverse ?? 0];
    case "radio":
      return [spec.radioRange ?? 0];
  }
}

const sqDist = (a: number[], b: number[]) =>
  a.reduce((sum, x, i) => sum + (x - (b[i] ?? 0)) ** 2, 0);

/**
 * Every selectable module combination for a tank, each with its full derived
 * characteristics, so the tank page's configurator can re-render the specs from
 * the modules the user picks. The combinations and their stats come from the
 * wot-src client XML (`wg.source.specs.configs`); each combination is tagged
 * with the WG module ids the tree renders, by matching per-slot signatures.
 * Returns an empty array when either source has nothing for the tank (the page
 * then shows the static stock specs, unchanged).
 */
export async function getTankConfigs(
  region: Region,
  tankId: number,
  modules?: TankModuleNode[],
): Promise<TankConfig[]> {
  const nodes = modules ?? (await getTankModules(region, tankId));
  if (nodes.length === 0) return [];

  const src = await wg.region(region).source.specs.configs(tankId);
  if (!src || src.configs.length === 0) return [];

  const bySlot: Record<Slot, TankModuleNode[]> = {
    gun: [],
    turret: [],
    engine: [],
    chassis: [],
    radio: [],
  };
  for (const node of nodes) {
    const slot = SLOT_BY_TYPE[node.type];
    if (slot) bySlot[slot].push(node);
  }

  const matchModule = (slot: Slot, spec: WotSrcSpec): number | null => {
    const cands = bySlot[slot];
    if (cands.length === 0) return null;
    if (cands.length === 1) return cands[0].moduleId;
    const target = specSignature(slot, spec);
    let best = cands[0].moduleId;
    let bestDist = Infinity;
    for (const c of cands) {
      const sig = nodeSignature(c.stats);
      if (!sig) continue;
      const d = sqDist(sig, target);
      if (d < bestDist) {
        bestDist = d;
        best = c.moduleId;
      }
    }
    return best;
  };

  return src.configs.map((c) => ({
    modules: {
      gun: matchModule("gun", c.spec),
      turret: matchModule("turret", c.spec),
      engine: matchModule("engine", c.spec),
      chassis: matchModule("chassis", c.spec),
      radio: matchModule("radio", c.spec),
    },
    specs: c.spec,
  }));
}
