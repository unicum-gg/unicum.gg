import { WotSrcBranch, type EquipmentSlot, type Region } from "@unicum.gg/wargaming";
import {
  parseTankRef,
  TankClient,
  type TankSpec,
  type VehicleMeta,
  type VehicleMode,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import type { MoeValues } from "@unicum.gg/core/moe";
import type { MomValues } from "@unicum.gg/core/mom";
import type { TankServerStats } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { getTankModules } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import {
  getTankConfigs,
  type TankConfig,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import {
  getTankLoadout,
  type LoadoutConsumable,
  type LoadoutDirective,
  type LoadoutEquipment,
} from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import {
  getTankCrew,
  type CrewMember,
  type CrewSkill,
} from "@unicum.gg/core/wargaming/wot/tanks/crew";
import {
  getTankFieldMods,
  type TankFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import {
  getTankSkillTree,
  type TankSkillTree,
} from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import { getTankVehicleModes } from "@unicum.gg/core/wargaming/wot/tanks/vehicle-modes";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { getSpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import {
  applyTestChanges,
  getTestChanges,
  getTestVersion,
} from "@unicum.gg/core/wargaming/wot/tanks/test-changes";

// Same fails-open boundary as the detail payload: a wot-src section that blips
// hides its panel on one column rather than failing the whole comparison.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * The mountable catalogues, hoisted out of the vehicles that reference them.
 *
 * Equipment, directives, consumables and crew skills are very nearly the same
 * lists on every vehicle (three tanks share 70 distinct devices out of 62-64
 * each), and they are three quarters of a vehicle's payload. Sent per column
 * they would be four near-identical copies of the game's whole provisions
 * catalogue; sent once, a four-way comparison costs about as much as a single
 * tank page.
 */
export interface CompareCatalog {
  equipment: LoadoutEquipment[];
  directives: LoadoutDirective[];
  consumables: LoadoutConsumable[];
  crewSkills: CrewSkill[];
}

/** One vehicle in a comparison: what it is, what it is made of, and which
 * catalogue entries it can mount (by key, resolved against `CompareCatalog`). */
export interface CompareVehicle {
  tankId: number;
  slug: string;
  /** The game client this column was read from. */
  client: TankClient;
  /** The Common Test build available for this vehicle, null when none is. */
  testVersion: string | null;
  meta: VehicleMeta;
  specs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  modes: VehicleMode[];
  loadout: {
    slots: EquipmentSlot[];
    equipmentKeys: string[];
    directiveKeys: string[];
    consumableKeys: string[];
  } | null;
  crew: { members: CrewMember[]; skillKeys: string[] } | null;
  fieldMods: TankFieldMods | null;
  skillTree: TankSkillTree | null;
  /** Server-average performance, for the comparison's Performances tab. */
  stats: TankServerStats | null;
  moe: MoeValues | null;
  mastery: MomValues | null;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
}

/** Everything one vehicle contributes on its own, before the catalogues are
 * hoisted out of it.
 *
 * `ref` is a column, so it may name a client alongside the vehicle
 * (`amx-13-90@ct`): the same tank on the live and the test build is two columns,
 * which is the comparison a running Common Test is actually read for.
 */
async function assembleVehicle(region: Region, ref: string) {
  const { slug, client } = parseTankRef(ref);
  const tank = await getTankBySlug(region, slug);
  if (!tank) return null;
  const { tankId, meta, slug: canonicalSlug } = tank;
  // Same rule as the tank page: an unreleased vehicle only exists on the test
  // client, so it is read there whether or not the column asked. Without this a
  // test-only vehicle compared as an ordinary column came out empty, its
  // configurations having no live branch to be found on.
  const onTest = meta.isCommonTest || client === TankClient.CommonTest;
  const branch = onTest ? WotSrcBranch.CT : undefined;

  const [modules, configs, loadout, crew, fieldMods, skillTree, modes, testVersion] =
    await Promise.all([
      getTankModules(region, tankId),
      safe(() => getTankConfigs(region, tankId, undefined, branch), [] as TankConfig[]),
      safe(() => getTankLoadout(region, tankId, branch), null),
      safe(() => getTankCrew(region, tankId, branch), null),
      safe(() => getTankFieldMods(region, tankId, branch), null),
      safe(() => getTankSkillTree(region, tankId, branch), null),
      safe(() => getTankVehicleModes(region, tankId, branch), [] as VehicleMode[]),
      safe(() => getTestVersion(tankId), null),
    ]);

  return {
    tankId,
    slug: canonicalSlug,
    // What this column is showing, and the test build available for the vehicle.
    // The caller rebuilds the column's reference from the two, so a redirect
    // onto the canonical slug cannot silently drop the client.
    client: onTest ? TankClient.CommonTest : TankClient.Live,
    testVersion,
    meta,
    modules,
    configs,
    loadout,
    crew,
    fieldMods,
    skillTree,
    modes,
  };
}

/**
 * Assemble a side-by-side comparison of several vehicles: every column's own
 * data, the catalogues they share, and the spread of the catalogue each
 * characteristic is scored against.
 *
 * Unknown slugs are dropped rather than failing the request, so a stale link
 * with one renamed vehicle still renders the rest. The returned `slug` on each
 * column is the canonical one, so the caller can redirect a legacy URL onto it.
 */
export async function assembleTankCompare(region: Region, refs: string[]) {
  const [assembled, dataset, wn8Map, wnxMap, ranges] = await Promise.all([
    Promise.all(refs.map((ref) => assembleVehicle(region, ref))),
    getTankDataset(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getSpecRanges(region),
  ]);

  const rows = new Map(dataset.map((r) => [r.identity.tankId, r]));

  // Hoisting the catalogues: first entry wins, so a device two vehicles both
  // mount is described once. Every vehicle keeps the keys it can mount, which is
  // what its slots are validated against on the other side.
  const equipment = new Map<string, LoadoutEquipment>();
  const directives = new Map<string, LoadoutDirective>();
  const consumables = new Map<string, LoadoutConsumable>();
  const crewSkills = new Map<string, CrewSkill>();

  const vehicles: CompareVehicle[] = [];
  for (const v of assembled) {
    if (!v) continue;
    for (const e of v.loadout?.equipment ?? [])
      if (!equipment.has(e.key)) equipment.set(e.key, e);
    for (const d of v.loadout?.directives ?? [])
      if (!directives.has(d.key)) directives.set(d.key, d);
    for (const c of v.loadout?.consumables ?? [])
      if (!consumables.has(c.key)) consumables.set(c.key, c);
    for (const s of v.crew?.skills ?? [])
      if (!crewSkills.has(s.key)) crewSkills.set(s.key, s);

    const row = rows.get(v.tankId);
    // The dataset is the live catalogue, so a test column's spec row has to be
    // brought onto the test build before it is handed over: it is what fills the
    // fields a wot-src configuration does not carry, and what the whole column
    // falls back to when the vehicle has no configurations at all. Without this
    // a column headed Common Test quietly showed live numbers.
    const specs =
      row?.specs && v.client === TankClient.CommonTest
        ? applyTestChanges(
            row.specs as Record<string, unknown>,
            (await getTestChanges(v.tankId)).changes,
          )
        : (row?.specs ?? null);
    vehicles.push({
      tankId: v.tankId,
      slug: v.slug,
      client: v.client,
      testVersion: v.testVersion,
      meta: v.meta,
      specs: specs as CompareVehicle["specs"],
      modules: v.modules,
      configs: v.configs,
      modes: v.modes,
      loadout: v.loadout
        ? {
            slots: v.loadout.slots,
            equipmentKeys: v.loadout.equipment.map((e) => e.key),
            directiveKeys: v.loadout.directives.map((d) => d.key),
            consumableKeys: v.loadout.consumables.map((c) => c.key),
          }
        : null,
      crew: v.crew
        ? { members: v.crew.members, skillKeys: v.crew.skills.map((s) => s.key) }
        : null,
      fieldMods: v.fieldMods,
      skillTree: v.skillTree,
      stats: row?.stats ?? null,
      moe: row?.moe ?? null,
      mastery: row?.mastery ?? null,
      wn8Expected: wn8Map.get(v.tankId) ?? null,
      wnxExpected: wnxMap.get(v.tankId) ?? null,
    });
  }

  return {
    vehicles,
    catalog: {
      equipment: [...equipment.values()],
      directives: [...directives.values()],
      consumables: [...consumables.values()],
      crewSkills: [...crewSkills.values()],
    } satisfies CompareCatalog,
    ranges,
  };
}
