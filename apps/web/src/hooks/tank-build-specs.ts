import {
  applyCamouflage,
  applyCamoNet,
  applyConsumables,
  applyCrewLevel,
  applyCrewQualification,
  applyCrewSkills,
  applyDirectives,
  applyEquipment,
  applyFieldMods,
  applyRepairs,
  applyVehicleMode,
  VehicleModeKind,
  type TankSpec,
  type VehicleMode,
} from "@unicum.gg/shared";
import { applyShell, type useAmmo } from "@/hooks/use-ammo";
import type { useCrewConfig } from "@/hooks/use-crew-config";
import type { useFieldMods } from "@/hooks/use-field-mods";
import type { useLoadout } from "@/hooks/use-loadout";
import type { useSkillTree } from "@/hooks/use-skill-tree";

// How a build's characteristics are composed, in the order the game composes
// them.
//
// Its own file because the order **is** the arithmetic. Every section of the
// configurator hands back what it changes, and what a reader sees is those
// changes laid over each other one at a time: the shell replaces the gun's own
// figures, the driving mode swaps the base state under everything, and crew,
// equipment and directives scale what is left. Rebuilt by hand anywhere else it
// is somewhere the order can drift, which is why the hook that owns the state
// does not also own this.

/**
 * Everything one pass over the pipeline reads.
 *
 * Built out of the section hooks' own return types rather than restated, so a
 * section that changes what it hands back is a compile error here instead of a
 * quietly mistyped argument.
 */
export type Composition = Pick<
  ReturnType<typeof useLoadout>,
  | "mounted"
  | "appliedDirectives"
  | "appliedCrewDirectives"
  | "directiveCamo"
  | "appliedConsumables"
  | "camoBonuses"
  | "equipmentCrewLevel"
  | "consumableCrewLevel"
> &
  Pick<
    ReturnType<typeof useCrewConfig>,
    | "appliedCrewSkills"
    | "crewLevel"
    | "crewLevelIncrease"
    | "repairSkill"
    | "repairLevel"
    | "camoLevel"
  > &
  Pick<ReturnType<typeof useFieldMods>, "appliedFieldMods"> &
  Pick<ReturnType<typeof useSkillTree>, "appliedSkillTree"> &
  Pick<ReturnType<typeof useAmmo>, "ammoShells" | "shellIdx"> & {
    specs: TankSpec | null;
    appliedMode: VehicleMode | null;
    /** Which mode is engaged, which the factors alone do not say. */
    modeActive: VehicleModeKind | null;
  };

export function composeSpecs({
  ammoShells,
  appliedConsumables,
  appliedCrewDirectives,
  appliedCrewSkills,
  appliedDirectives,
  appliedFieldMods,
  appliedMode,
  appliedSkillTree,
  camoBonuses,
  camoLevel,
  consumableCrewLevel,
  crewLevel,
  crewLevelIncrease,
  directiveCamo,
  equipmentCrewLevel,
  mounted,
  repairLevel,
  repairSkill,
  shellIdx,
  specs,
  modeActive,
}: Composition): TankSpec | null {
  if (!specs) return specs;
  // **A calibrated gun fires a different shell, so it is swapped in first.**
  // The Pz.Kpfw. Neu opens extra chambers when it deploys and gives up armour
  // damage for penetrating power: the client states the new figures in the
  // deployed definition, shell by shell, and only for the two its gun lists.
  // Applied here rather than in the mode's own factors, because it is not a
  // factor at all: it replaces the shell's own numbers the way picking
  // another shell would.
  const loaded = ammoShells[shellIdx];
  const calibrated =
    modeActive === VehicleModeKind.Siege && loaded?.calibrated
      ? { ...loaded, damage: loaded.calibrated.damage ?? loaded.damage }
      : loaded;
  const withShell = applyShell(specs, calibrated);
  if (!withShell) return withShell;
  // Driving mode (siege / rapid) is a base-state swap: it scales the handling
  // and mobility characteristics by WG's mode-vs-travel ratios before anything
  // else, so equipment, crew and field mods then compose on top of the
  // deployed values (a mounted rammer speeds up the siege reload, etc.).
  const withMode = appliedMode
    ? applyVehicleMode(withShell, appliedMode, shellIdx)
    : withShell;
  // The crew's major-qualification level (the slider) degrades every
  // crew-affected stat below 100%; nominal at 100%. Applied first, then the
  // trained skills/perks build on top.
  const withQual =
    crewLevel < 1 ? applyCrewQualification(withMode, crewLevel) : withMode;
  const withEquip = mounted.length ? applyEquipment(withQual, mounted) : withQual;
  const withDirectives = appliedDirectives.length
    ? applyDirectives(withEquip, appliedDirectives)
    : withEquip;
  const withConsumables = appliedConsumables.length
    ? applyConsumables(withDirectives, appliedConsumables)
    : withDirectives;
  // Unlocked field modifications (base steps + chosen dual sides) OR skill-tree
  // nodes (tier XI) — a vehicle has one system or the other, never both. Both
  // are the same factor bag, so applyFieldMods handles them; the per-shell
  // penetration mods gate on the selected shell.
  const progressionMods = appliedFieldMods.length
    ? appliedFieldMods
    : appliedSkillTree;
  const withFieldMods = progressionMods.length
    ? applyFieldMods(withConsumables, progressionMods, shellIdx)
    : withConsumables;
  const withCrew = appliedCrewSkills.length
    ? applyCrewSkills(withFieldMods, appliedCrewSkills, crewLevel)
    : withFieldMods;
  // Crew directives grant a skill at their boost multiplier, applied like a
  // crew skill (each carries its own scale, so a full-strength level here).
  const withCrewDirectives = appliedCrewDirectives.length
    ? applyCrewSkills(withCrew, appliedCrewDirectives, 1)
    : withCrew;
  // Brothers in Arms + Improved Ventilation + food all raise the crew level.
  const totalCrewLevel =
    crewLevelIncrease + equipmentCrewLevel + consumableCrewLevel;
  // The Repairs common skill, applied once at its crew-averaged coverage level
  // (shortens the track repair time via the crew role factor), rather than
  // compounded per member. The crew-level boost speeds it up further, in game.
  const withRepair =
    repairSkill && repairLevel > 0
      ? applyRepairs(withCrewDirectives, repairLevel, totalCrewLevel)
      : withCrewDirectives;
  const withCrewLevel =
    totalCrewLevel > 0 ? applyCrewLevel(withRepair, totalCrewLevel) : withRepair;
  // Camo is stored at full Camouflage skill; re-base it to the skill's actual
  // level (0 by default = the no-skill value shown as the baseline). The
  // Concealment directive grants the skill (min level 1) and scales it.
  const effCamoLevel = directiveCamo.granted
    ? Math.max(camoLevel, 1) * directiveCamo.factor
    : camoLevel;
  const withCamo = applyCamouflage(withCrewLevel, effCamoLevel);
  // Camo devices (net / low-noise exhaust) add their bonus on top of that.
  const withNet =
    camoBonuses.still > 0 || camoBonuses.moving > 0
      ? applyCamoNet(withCamo, camoBonuses.still, camoBonuses.moving)
      : withCamo;
  return withNet;
}
