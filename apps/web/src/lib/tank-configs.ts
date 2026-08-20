import { ModuleType } from "@unicum.gg/wargaming";
import type {
  TankConfig,
  TankConfigModules,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import { MODULE_SLOTS } from "@/components/tanks/detail/specifications/config-url";

export type ModuleSlot = keyof TankConfigModules;

export const SLOT_BY_MODULE_TYPE: Partial<Record<ModuleType, ModuleSlot>> = {
  [ModuleType.Gun]: "gun",
  [ModuleType.Turret]: "turret",
  [ModuleType.Engine]: "engine",
  [ModuleType.Chassis]: "chassis",
  [ModuleType.Radio]: "radio",
};

/** The slot order these helpers read a positional module list in. It is the one
 * `config-url` encodes a shared build with, not a second copy of it: the two are
 * the write and read sides of the same `m=` array, so a reorder here that the
 * encoder did not make would resolve a turret id into the gun slot on every link
 * already out there. */
const MODULE_SLOTS_ORDER: ModuleSlot[] = MODULE_SLOTS;

/**
 * Which of a vehicle's derived module combinations a build sits on.
 *
 * A tank's characteristics are only ever read off one of these combinations, so
 * every way of choosing one (the stock it ships with, the fully-upgraded one, a
 * shared link's module ids, a module the reader just clicked) resolves to an
 * index here rather than to a hand-assembled spec.
 */

/** How many slots two module tuples agree on. */
export function moduleOverlap(a: TankConfigModules, b: TankConfigModules): number {
  return MODULE_SLOTS_ORDER.reduce((n, s) => n + (a[s] === b[s] ? 1 : 0), 0);
}

/** The all-stock configuration: the combination closest to the modules the tank
 * ships with. The build opens on it and the characteristics diff against it, so
 * upgrading a module or mounting equipment shows the change from stock. */
export function stockConfigIdx(
  configs: TankConfig[],
  modules: TankModuleNode[],
): number {
  if (configs.length === 0) return 0;
  const stock: TankConfigModules = {
    gun: null,
    turret: null,
    engine: null,
    chassis: null,
    radio: null,
  };
  for (const node of modules) {
    const slot = node.isDefault ? SLOT_BY_MODULE_TYPE[node.type] : undefined;
    if (slot) stock[slot] = node.moduleId;
  }
  let best = 0;
  let bestScore = -1;
  configs.forEach((c, i) => {
    const s = moduleOverlap(c.modules, stock);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

/**
 * How far along its slot's progression a module sits, most advanced first.
 *
 * Tier leads, but it does not settle everything: the E 100 mounts a 12.8 cm and
 * a 15 cm gun, both tier X, both terminal, and the upgrade is the one the tank
 * does not ship with (its unlock edge comes from the turret, so neither gun
 * points at the other). Hence the stock flag, then the research price, which is
 * what separates two researched modules of the same tier.
 */
function moduleRank(m: TankModuleNode): [number, number, number] {
  return [m.tier ?? 0, m.isDefault ? 0 : 1, m.priceXp];
}

function outranks(a: TankModuleNode, b: TankModuleNode): boolean {
  const ra = moduleRank(a);
  const rb = moduleRank(b);
  for (let i = 0; i < ra.length; i += 1) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i];
  }
  return false;
}

/** The fully-upgraded module per slot, read off the research DAG rather than the
 * config order: a slot's top module is the most advanced of those no other
 * module of the same slot unlocks past (its leaves). Empty when WG exposes no
 * module tree for the tank (the special/reward vehicles its encyclopedia
 * omits). */
export function topModuleIds(
  modules: TankModuleNode[],
): Partial<Record<ModuleSlot, number>> {
  const byId = new Map(modules.map((m) => [m.moduleId, m]));
  const out: Partial<Record<ModuleSlot, number>> = {};
  for (const node of modules) {
    const slot = SLOT_BY_MODULE_TYPE[node.type];
    if (!slot) continue;
    // A module that unlocks another of its own slot is not the last one.
    const unlocksSameSlot = node.nextModules.some((id) => {
      const next = byId.get(id);
      return next && SLOT_BY_MODULE_TYPE[next.type] === slot;
    });
    if (unlocksSameSlot) continue;
    const currentId = out[slot];
    const current = currentId != null ? byId.get(currentId) : undefined;
    if (!current || outranks(node, current)) out[slot] = node.moduleId;
  }
  return out;
}

/** The config index mounting the most top modules (the game's "Standard"
 * configuration). Unlike `resolveConfigIdx`, which needs every requested slot to
 * match, this scores: a top gun that no turret in the catalogue pairs with still
 * lands on the closest combination rather than falling back to stock. */
export function topConfigIdx(
  configs: TankConfig[],
  modules: TankModuleNode[],
  fallbackIdx: number,
): number {
  if (configs.length === 0) return fallbackIdx;
  const tops = topModuleIds(modules);
  const wanted = MODULE_SLOTS_ORDER.filter((s) => tops[s] != null);
  // No WG module tree to read: the derivation walks the client's module lists in
  // research order, so the last combination is the fully-upgraded one.
  if (wanted.length === 0) return configs.length - 1;
  let best = fallbackIdx;
  let bestScore = -1;
  configs.forEach((c, i) => {
    const score = wanted.reduce((n, s) => n + (c.modules[s] === tops[s] ? 1 : 0), 0);
    // `>=` so a tie lands on the later (more upgraded) combination.
    if (score >= bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Find the config that mounts the requested module ids (every specified slot
 * must match), falling back to `fallbackIdx` for an unknown combination — a
 * shared link built before a rebalance stays harmless. */
export function resolveConfigIdx(
  configs: TankConfig[],
  ids: (number | null)[] | undefined,
  fallbackIdx: number,
): number {
  if (!ids) return fallbackIdx;
  let best = -1;
  let bestScore = -1;
  configs.forEach((c, i) => {
    let score = 0;
    let ok = true;
    MODULE_SLOTS_ORDER.forEach((slot, si) => {
      const want = ids[si];
      if (want == null) return;
      if (c.modules[slot] === want) score += 1;
      else ok = false;
    });
    if (ok && score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best >= 0 ? best : fallbackIdx;
}

/** The config that mounts `moduleId` in its slot and otherwise overlaps `from`
 * the most, or null when the module belongs to no combination. Every
 * combination is valid, but a module may be incompatible with the rest of the
 * current selection (a gun that needs another turret). */
export function configIdxForModule(
  configs: TankConfig[],
  type: ModuleType,
  moduleId: number,
  from: TankConfig | null,
): number | null {
  const slot = SLOT_BY_MODULE_TYPE[type];
  if (!slot) return null;
  let best = -1;
  let bestScore = -1;
  configs.forEach((c, i) => {
    if (c.modules[slot] !== moduleId) return;
    const score = from ? moduleOverlap(c.modules, from.modules) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}
