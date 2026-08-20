"use client";

import { useCallback, useMemo, useState } from "react";
import type { ModuleType } from "@unicum.gg/wargaming";
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
  type TankSpec,
  type VehicleMode,
} from "@unicum.gg/shared";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import {
  encodeSetup,
  MODULE_SLOTS,
  type DecodedConfig,
} from "@/components/tanks/detail/specifications/config-url";
import {
  configIdxForModule,
  resolveConfigIdx,
  stockConfigIdx,
  topConfigIdx,
} from "@/lib/tank-configs";
import { useAmmo, applyShell } from "@/hooks/use-ammo";
import { useCrewConfig } from "@/hooks/use-crew-config";
import { useFieldMods } from "@/hooks/use-field-mods";
import { useLoadout } from "@/hooks/use-loadout";
import { useSkillTree } from "@/hooks/use-skill-tree";
import { useVehicleMode } from "@/hooks/use-vehicle-mode";

/** Everything a vehicle brings to a build: what it is made of and what can be
 * mounted on it. The same shape the tank page and a compare column both hold. */
export interface TankBuildData {
  stockSpecs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  loadout: TankLoadout | null;
  crew: TankCrew | null;
  fieldMods: TankFieldMods | null;
  skillTree: TankSkillTree | null;
  modes: VehicleMode[];
}

/** Which configuration an unseeded build opens on. The tank page opens on
 * `Stock` (what you own before researching anything); a comparison opens on
 * `Top`, since comparing stock vehicles is not what anyone means by it. */
export enum DefaultModules {
  Stock = "stock",
  Top = "top",
}

export interface TankBuildOptions {
  defaultModules?: DefaultModules;
}

export type TankBuild = ReturnType<typeof useTankBuild>;

/**
 * A vehicle's whole configurable state, from the mounted modules down to the
 * crew's skills, reduced to the characteristics it produces.
 *
 * It is one hook rather than the caller's own composition of the seven section
 * hooks because the order the sections apply in *is* the game's math (a shell
 * replaces base values before a rammer scales the reload, a driving mode swaps
 * the base state before anything composes on it), so anywhere it is rebuilt by
 * hand is somewhere it can drift. The tank page mounts one, a comparison mounts
 * one per column, and both read the same numbers for the same setup token.
 */
export function useTankBuild(
  data: TankBuildData,
  initial?: DecodedConfig,
  options?: TankBuildOptions,
) {
  const { stockSpecs, modules, configs, loadout, crew, fieldMods, skillTree, modes } =
    data;
  // The seed is the intent decoded from a shared URL. Frozen on mount: it seeds
  // the sections once, and later edits belong to their own state, so a re-render
  // never rewinds the build to the link it came from.
  const [seed] = useState<DecodedConfig>(() => initial ?? {});

  const interactive = configs.length > 0;

  // The all-stock configuration (every module the tank ships with): the build
  // opens on it and it is the baseline the characteristics diff against, so
  // upgrading modules or mounting equipment shows the change from stock.
  const stockIdx = useMemo(
    () => (interactive ? stockConfigIdx(configs, modules) : 0),
    [configs, modules, interactive],
  );

  // The top-modules index, also the opening one when the caller asks for it and
  // the shared URL carries no module choice of its own.
  const topIdx = useMemo(
    () => (interactive ? topConfigIdx(configs, modules, stockIdx) : 0),
    [interactive, configs, modules, stockIdx],
  );

  // Which configuration this build opens on, and the one the URL therefore
  // leaves unwritten: stock on a tank page, top in a comparison.
  const defaultIdx =
    options?.defaultModules === DefaultModules.Top ? topIdx : stockIdx;

  const [activeIdx, setActiveIdx] = useState(() => {
    if (!interactive) return 0;
    return resolveConfigIdx(configs, seed.modules, defaultIdx);
  });
  const active = interactive ? configs[activeIdx] : null;

  // The stock spec (all default modules, no equipment): the reference every
  // characteristic is compared against.
  const baselineSpec: TankSpec | null = useMemo(() => {
    if (!interactive || !configs[stockIdx]) return null;
    const base = { ...(stockSpecs ?? {}), ...configs[stockIdx].specs } as TankSpec;
    // Our stored camo is the fully-trained-Camouflage value; the no-skill
    // baseline (like every other stat) is 57% of it, so the Camouflage skill
    // has room to raise it back up.
    return applyCamouflage(base, 0);
  }, [interactive, configs, stockIdx, stockSpecs]);

  const selectedModules = active?.modules ?? null;

  const ammo = useAmmo(active, modules, seed.shell);
  const { ammoShells, shellIdx } = ammo;

  const specs: TankSpec | null = useMemo(() => {
    if (!active) return stockSpecs;
    // Merge over the stock row so tank-level fields the derivation doesn't carry
    // (researchXp, description) survive; the config's values win for everything
    // it computes.
    return { ...(stockSpecs ?? {}), ...active.specs } as TankSpec;
  }, [active, stockSpecs]);

  const loadoutState = useLoadout(loadout, {
    equipment: seed.equipment,
    roleCats: seed.roleCats,
    directives: seed.directives,
    consumables: seed.consumables,
  });
  const crewState = useCrewConfig(crew, {
    skills: seed.crewSkills,
    level: seed.crewLevel,
  });
  const fieldModsState = useFieldMods(fieldMods, {
    level: seed.fieldModLevel,
    pairs: seed.fieldModPairs,
  });
  const skillTreeState = useSkillTree(skillTree, seed.unlocked);
  const modeState = useVehicleMode(modes, seed.mode);

  const {
    mounted,
    appliedDirectives,
    appliedCrewDirectives,
    directiveCamo,
    appliedConsumables,
    camoBonuses,
    equipmentCrewLevel,
    consumableCrewLevel,
  } = loadoutState;
  const {
    appliedCrewSkills,
    crewLevel,
    crewLevelIncrease,
    repairSkill,
    repairLevel,
    camoLevel,
  } = crewState;
  const { appliedFieldMods } = fieldModsState;
  const { appliedSkillTree } = skillTreeState;
  const { appliedMode } = modeState;

  // Characteristics reflect the selected shell first (it *replaces* base values:
  // damage, penetration, velocity, cost), then modules + equipment + directives
  // + consumables + crew skills scale on top. The shell must come first or a
  // multiplier on a per-shell stat (Perfect Charge's +10% shell velocity) would
  // be clobbered by the raw shell value.
  const finalSpecs: TankSpec | null = useMemo(() => {
    if (!specs) return specs;
    const withShell = applyShell(specs, ammoShells[shellIdx]);
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
  }, [
    specs,
    appliedMode,
    mounted,
    appliedDirectives,
    appliedCrewDirectives,
    directiveCamo,
    appliedConsumables,
    appliedFieldMods,
    appliedSkillTree,
    appliedCrewSkills,
    repairSkill,
    repairLevel,
    crewLevel,
    crewLevelIncrease,
    equipmentCrewLevel,
    consumableCrewLevel,
    camoLevel,
    camoBonuses,
    ammoShells,
    shellIdx,
  ]);

  /** Mount a module, snapping to the configuration closest to the current one. */
  const select = useCallback(
    (type: ModuleType, moduleId: number) => {
      const idx = configIdxForModule(configs, type, moduleId, active);
      if (idx != null) setActiveIdx(idx);
    },
    [active, configs],
  );

  /** Mount every top module at once (the game's "Standard" configuration). */
  const selectTopModules = useCallback(() => {
    if (!interactive) return;
    setActiveIdx(topIdx);
  }, [interactive, topIdx]);

  /** Strip the vehicle back to the modules it ships with. */
  const selectStockModules = useCallback(() => {
    if (!interactive) return;
    setActiveIdx(stockIdx);
  }, [interactive, stockIdx]);

  // "Modified" and "reset" are both measured against the configuration this
  // build opened on, not against stock: in a comparison every column starts on
  // its top modules, so treating that as a modification would light up every
  // column before anyone had touched anything, and resetting would drop them to
  // stock rather than back to where they started. On a tank page the two are the
  // same configuration, so nothing changes there.
  const modulesDirty = interactive && activeIdx !== defaultIdx;
  const resetModules = useCallback(() => setActiveIdx(defaultIdx), [defaultIdx]);

  const canResetAll =
    ammo.isDirty ||
    loadoutState.equipmentDirty ||
    loadoutState.consumablesDirty ||
    loadoutState.directivesDirty ||
    fieldModsState.isDirty ||
    skillTreeState.isDirty ||
    modeState.isDirty ||
    crewState.crewDirty ||
    modulesDirty;

  function resetAll() {
    ammo.reset();
    loadoutState.resetEquipment();
    loadoutState.resetConsumables();
    loadoutState.resetDirectives();
    fieldModsState.reset();
    skillTreeState.reset();
    modeState.reset();
    crewState.resetCrew();
    resetModules();
  }

  // The opaque token for the current selection (null when pristine). Shared by
  // the URL mirror and the "Share build" affordance so both stay in sync.
  //
  // `writeModules` is what separates the two tokens below: the short one leaves
  // the modules out when they are the ones the build opened on, the portable one
  // always writes them. See `setupToken` / `portableSetupToken`.
  const encode = useCallback(
    (writeModules: boolean) => {
    const curModules = MODULE_SLOTS.map((s) => active?.modules[s] ?? null);
    const defaultModules = writeModules
      ? []
      : MODULE_SLOTS.map((s) => configs[defaultIdx]?.modules[s] ?? null);
    return encodeSetup({
      shell: shellIdx,
      modules: curModules,
      defaultModules,
      equipment: loadoutState.equipped,
      roleCats: loadoutState.roleCats,
      slots: loadout?.slots ?? [],
      consumables: loadoutState.consumableSlots,
      directives: [...loadoutState.activeDirectives],
      fieldModLevel: fieldModsState.level,
      fieldModPairs: fieldModsState.pairChoices,
      unlocked: [...skillTreeState.unlocked],
      crewSkills: [...crewState.selectedSkills],
      crewLevel: crewState.crewLevel,
      mode: modeState.active,
    });
    },
    [
    active,
    configs,
    defaultIdx,
    loadout,
    shellIdx,
    loadoutState.equipped,
    loadoutState.roleCats,
    loadoutState.consumableSlots,
    loadoutState.activeDirectives,
    fieldModsState.level,
    fieldModsState.pairChoices,
    skillTreeState.unlocked,
    crewState.selectedSkills,
    crewState.crewLevel,
    modeState.active,
    ],
  );

  const setupToken = useMemo(() => encode(false), [encode]);
  /** The same setup with its modules spelled out, for carrying the build to a
   * context whose default configuration is a different one: the tank page opens
   * on stock and a comparison column on top, so the short token would silently
   * swap the vehicle's modules on the way over. */
  const portableSetupToken = useMemo(() => encode(true), [encode]);

  return {
    interactive,
    /** The mounted module configuration, or null when the tank has none. */
    active,
    selectedModules,
    select,
    selectTopModules,
    selectStockModules,
    /** Whether every slot already mounts its top module. */
    isTopModules: interactive && activeIdx === topIdx,
    /** Whether the vehicle is on the modules it ships with. */
    isStockModules: interactive && activeIdx === stockIdx,
    /** Whether the vehicle has anything to research at all: false for the
     * vehicles whose stock configuration is already the top one. */
    hasModuleChoice: interactive && stockIdx !== topIdx,
    modulesDirty,
    resetModules,
    /** The characteristics as configured: what every consumer reads. */
    finalSpecs,
    /** The all-stock reference the characteristics are coloured against. */
    baselineSpec,
    setupToken,
    portableSetupToken,
    canResetAll,
    resetAll,
    ammo,
    loadout: loadoutState,
    crew: crewState,
    fieldMods: fieldModsState,
    skillTree: skillTreeState,
    mode: modeState,
  };
}
