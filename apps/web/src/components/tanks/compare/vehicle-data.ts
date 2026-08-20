import type {
  CompareCatalog,
  CompareVehicle,
} from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankBuildData } from "@/hooks/use-tank-build";

/**
 * Put a comparison column's vehicle back together: the endpoint hoists the
 * mountable catalogues out of the vehicles and leaves each one holding keys, so
 * a four-way comparison ships one copy of the game's provisions instead of four.
 * Rebuilding them here is what lets a column drive the very same
 * `useTankBuild` the tank page does, with no compare-aware branch inside it.
 *
 * Keys the catalogue doesn't describe are dropped rather than faked: a device
 * that vanished between the payload and this render is one the column can't
 * mount, which is exactly how the tank page treats it too.
 */
export function toBuildData(
  vehicle: CompareVehicle,
  catalog: CompareCatalog,
): TankBuildData {
  const equipment = new Map(catalog.equipment.map((e) => [e.key, e]));
  const directives = new Map(catalog.directives.map((d) => [d.key, d]));
  const consumables = new Map(catalog.consumables.map((c) => [c.key, c]));
  const skills = new Map(catalog.crewSkills.map((s) => [s.key, s]));

  const pick = <V>(map: Map<string, V>, keys: string[]): V[] =>
    keys.map((k) => map.get(k)).filter((v): v is V => v != null);

  const loadout: TankLoadout | null = vehicle.loadout
    ? {
        slots: vehicle.loadout.slots,
        equipment: pick(equipment, vehicle.loadout.equipmentKeys),
        directives: pick(directives, vehicle.loadout.directiveKeys),
        consumables: pick(consumables, vehicle.loadout.consumableKeys),
      }
    : null;

  const crew: TankCrew | null = vehicle.crew
    ? { members: vehicle.crew.members, skills: pick(skills, vehicle.crew.skillKeys) }
    : null;

  return {
    stockSpecs: vehicle.specs,
    modules: vehicle.modules,
    configs: vehicle.configs,
    loadout,
    crew,
    fieldMods: vehicle.fieldMods,
    skillTree: vehicle.skillTree,
    modes: vehicle.modes,
  };
}
