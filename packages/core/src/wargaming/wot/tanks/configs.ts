import {
  branchFor,
  ModuleType,
  Region,
  type WotSrcSpec,
  WotSrcBranch,
} from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// wot-src client data changes only on a game patch (refreshed daily by
// vehicles-cron), so the parsed result is cached in Redis for a day — shared
// across instances and, unlike an in-process cache, surviving deploys so tank
// pages aren't all cold after a ship.
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;
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
export type TankConfig = {
  modules: TankConfigModules;
  /**
   * The wot-src keys the combination was derived from, one per slot.
   *
   * **The only name the geometry mirror shares with this side.** The mirror is
   * read out of the game client and knows nothing of WG's module ids, but it
   * publishes which piece each module draws under exactly these keys, so a
   * reader who picks the E 100's 15 cm gun can be shown `Gun_06` rather than
   * whichever piece happened to sort first.
   */
  keys: Record<Slot, string>;
  specs: WotSrcSpec;
};

type Slot = keyof TankConfigModules;

const SLOTS: Slot[] = ["gun", "turret", "engine", "chassis", "radio"];

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
 * the modules the user picks. The combinations and their stats (including the
 * per-shell ammo) come from the wot-src client XML (`wg.source.specs.configs`);
 * each combination is tagged with the WG module ids the tree renders, by
 * matching per-slot signatures. When WG's encyclopedia has no module tree for
 * the tank (special/reward tanks it omits, e.g. the WT auf E 100 T), the wot-src
 * configs are still returned with null module ids: no selectable modules, but
 * the characteristics and ammunition render from wot-src all the same. Returns
 * an empty array only when wot-src itself has nothing (the page then shows the
 * static stock specs, unchanged).
 */
/**
 * Generation of the config shape, in the key.
 *
 * Entries live for a day, so a field added to what a config publishes is a
 * field absent from every warm entry until the TTL turns over. That is not a
 * crash, which is what makes it worse: the reader silently loses whatever the
 * new field was for. Adding the per-shell calibre, normalisation and ricochet
 * cost the hero its live armour view on every vehicle whose configs happened to
 * be warm, and the one tank that had been recomputed was the only one that
 * worked. Bump this on any change to what `computeSpec` publishes.
 *
 * The same guard `tankdetail` keeps one layer up, for the same reason.
 *
 * v2: what a shell does against sloped armour, per shell.
 * v3: a step of the same unreleased branch as v4, superseded before either was
 *     deployed. Every generation that reached a deploy has its own line, which
 *     is the whole use of this list.
 * v4: what a shell becomes once a calibrating gun deploys.
 * v5: the gun's depression and elevation, which were each other's.
 */
const SHAPE_VERSION = 5;

export function getTankConfigs(
  region: Region,
  tankId: number,
  modules?: TankModuleNode[],
  branch?: WotSrcBranch,
): Promise<TankConfig[]> {
  // The region stays in the key alongside the branch, never instead of it: what
  // is cached here is region-scoped (module ids from that region's encyclopedia,
  // its CDN asset hosts), so a key naming only the branch would answer an EU
  // request with whichever region warmed it first.
  return cachedInRedis(`wotsrc:configs:v${SHAPE_VERSION}:${region}${branch ? `:${branch}` : ""}:${tankId}`, WOTSRC_TTL_SECONDS, () =>
    computeTankConfigs(region, tankId, modules, branch),
  );
}

async function computeTankConfigs(
  region: Region,
  tankId: number,
  modules?: TankModuleNode[],
  branch?: WotSrcBranch,
): Promise<TankConfig[]> {
  const nodes = modules ?? (await getTankModules(region, tankId));

  const src = await wg.region(region).source.specs.configs(tankId, branch);
  if (!src || src.configs.length === 0) return [];
  // No WG module tree (a tank its encyclopedia omits): keep going with the
  // wot-src configs. `bySlot` stays empty below, so `matchModule` returns null
  // for every slot and the combination carries no selectable module ids, but
  // its characteristics and ammo still render.

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

  // Matching by signature only works while the numbers being matched are the
  // ones WG's module tree was built from. They are not on a test build: it moves
  // them, and a nearest-value match then lands two configurations on the same
  // module the moment a rebalance pushes one slot's value onto another's live
  // one. (Observed: the AMX 13 90's test suspensions traverse at 36 and 38 where
  // WG lists 38 and 40, so both claimed the stock chassis and the upgraded one
  // became unreachable.)
  //
  // So when the configurations come from another client than the module tree,
  // the *identity* of a module is resolved on the live branch, where the
  // signatures still agree with WG, and only its *characteristics* come from the
  // test build. wot-src keys a module by name, and a rebalance does not rename
  // it, which is what makes the two sides line up.
  const byKey =
    branch && branch !== branchFor(region)
      ? await liveModuleIdsByKey(region, tankId, matchModule)
      : null;

  const moduleId = (slot: Slot, c: (typeof src.configs)[number]): number | null =>
    // Falls back to the signature match for a module the live branch has never
    // seen, which is the one the test actually introduces.
    byKey?.[slot].get(c.keys[slot]) ?? matchModule(slot, c.spec);

  return src.configs.map((c) => ({
    keys: c.keys,
    modules: {
      gun: moduleId("gun", c),
      turret: moduleId("turret", c),
      engine: moduleId("engine", c),
      chassis: moduleId("chassis", c),
      radio: moduleId("radio", c),
    },
    specs: c.spec,
  }));
}

/**
 * The WG module id behind each wot-src module key, resolved on the region's live
 * branch where the signatures still match WG's own numbers.
 *
 * Empty on any failure: the caller then matches by signature as before, which is
 * the behaviour this replaces rather than a broken state.
 */
async function liveModuleIdsByKey(
  region: Region,
  tankId: number,
  match: (slot: Slot, spec: WotSrcSpec) => number | null,
): Promise<Record<Slot, Map<string, number>>> {
  const out = {
    gun: new Map<string, number>(),
    turret: new Map<string, number>(),
    engine: new Map<string, number>(),
    chassis: new Map<string, number>(),
    radio: new Map<string, number>(),
  };
  const live = await wg
    .region(region)
    .source.specs.configs(tankId)
    .catch(() => null);
  for (const c of live?.configs ?? []) {
    for (const slot of SLOTS) {
      const key = c.keys[slot];
      if (!key || out[slot].has(key)) continue;
      const id = match(slot, c.spec);
      if (id !== null) out[slot].set(key, id);
    }
  }
  return out;
}
