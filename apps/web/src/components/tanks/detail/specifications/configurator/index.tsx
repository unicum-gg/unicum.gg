"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ModuleType, type Region } from "@unicum.gg/wargaming";
import {
  applyEquipment,
  applyDirectives,
  applyConsumables,
  applyFieldMods,
  applyCrewSkills,
  applyRepairs,
  applyCrewLevel,
  applyCrewQualification,
  applyCamouflage,
  applyCamoNet,
  type VehicleMeta,
  type TankSpec,
} from "@unicum.gg/shared";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type {
  TankConfig,
  TankConfigModules,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankCrew as TankCrewData } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods as TankFieldModsData } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankSkillTree as TankSkillTreeData } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import { TankCharacteristics } from "@/components/tanks/detail/specifications/characteristics";
import { TankConfiguratorSkeleton } from "@/components/tanks/detail/specifications/configurator/skeleton";
import { CharacteristicsChanges } from "@/components/tanks/detail/specifications/characteristics/changes-overlay";
import { TankModules } from "@/components/tanks/detail/specifications/modules";
import { TankEquipment } from "@/components/tanks/detail/specifications/equipment";
import { TankDirectives } from "@/components/tanks/detail/specifications/directives";
import { TankAmmo } from "@/components/tanks/detail/specifications/ammo";
import { TankConsumables } from "@/components/tanks/detail/specifications/consumables";
import { TankCrew } from "@/components/tanks/detail/specifications/crew";
import { TankFieldModifications } from "@/components/tanks/detail/specifications/field-mods";
import { TankSkillTree } from "@/components/tanks/detail/specifications/skill-tree";
import { PanelSeparator } from "@/components/panel";
import { cn } from "@/lib/utils";
import { useLoadout } from "@/hooks/use-loadout";
import { useCrewConfig } from "@/hooks/use-crew-config";
import { useFieldMods } from "@/hooks/use-field-mods";
import { useSkillTree } from "@/hooks/use-skill-tree";
import { useAmmo, applyShell } from "@/hooks/use-ammo";
import {
  decodeSetup,
  encodeSetup,
  resolveModuleIdx,
  MODULE_SLOTS,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";
import { BuildShare } from "@/components/tanks/detail/specifications/build-share";

type Slot = keyof TankConfigModules;

const SLOT_BY_TYPE: Partial<Record<ModuleType, Slot>> = {
  [ModuleType.Gun]: "gun",
  [ModuleType.Turret]: "turret",
  [ModuleType.Engine]: "engine",
  [ModuleType.Chassis]: "chassis",
  [ModuleType.Radio]: "radio",
};

const SLOTS: Slot[] = ["gun", "turret", "engine", "chassis", "radio"];

/** How many slots two module tuples agree on (used to snap to the config
 * closest to the current selection when a picked module forces others). */
function overlap(a: TankConfigModules, b: TankConfigModules): number {
  return SLOTS.reduce((n, s) => n + (a[s] === b[s] ? 1 : 0), 0);
}

/**
 * The Characteristics + Modules blocks, linked: the stock modules start
 * selected and picking a module re-renders the characteristics from that
 * combination. When there are no configs (wot-src has nothing for the tank) it
 * degrades to the static stock specs + a non-interactive module tree.
 */
type TankConfiguratorProps = {
  region: Region;
  meta: VehicleMeta;
  tankName: string;
  slug: string;
  stockSpecs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  loadout: TankLoadout | null;
  crew: TankCrewData | null;
  fieldMods: TankFieldModsData | null;
  skillTree: TankSkillTreeData | null;
  nextTanks: ResearchPathItem[];
};

// The stateful configurator can't be threaded with a `loading` flag (its ~15
// hooks would break the rules-of-hooks early return), so the loading twin is a
// thin wrapper that swaps in the co-located skeleton before any hook runs.
export function TankConfigurator(
  props: { loading: true } | TankConfiguratorProps,
) {
  if ("loading" in props) return <TankConfiguratorSkeleton />;
  return <TankConfiguratorInner {...props} />;
}

function TankConfiguratorInner({
  region,
  meta,
  tankName,
  slug,
  stockSpecs,
  modules,
  configs,
  loadout,
  crew,
  fieldMods,
  skillTree,
  nextTanks,
}: TankConfiguratorProps) {
  const interactive = configs.length > 0;

  // A shared setup rides in the query string: decode it once (SSR and client see
  // the same params, so the initial render matches), seed every section from it,
  // and mirror later edits back into the URL so the link stays shareable.
  const searchParams = useSearchParams();
  const [initialConfig] = useState(() =>
    decodeSetup(searchParams.get(SETUP_PARAM)),
  );

  // The all-stock configuration (every module the tank ships with): the page
  // opens on it and it is the baseline the characteristics diff against, so
  // upgrading modules or mounting equipment shows the change from stock.
  const stockIdx = useMemo(() => {
    if (!interactive) return 0;
    const stock: TankConfigModules = {
      gun: null,
      turret: null,
      engine: null,
      chassis: null,
      radio: null,
    };
    for (const node of modules) {
      const slot = node.isDefault ? SLOT_BY_TYPE[node.type] : undefined;
      if (slot) stock[slot] = node.moduleId;
    }
    let best = 0;
    let bestScore = -1;
    configs.forEach((c, i) => {
      const s = overlap(c.modules, stock);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    return best;
  }, [configs, modules, interactive]);

  const [activeIdx, setActiveIdx] = useState(() =>
    interactive ? resolveModuleIdx(configs, initialConfig.modules, stockIdx) : 0,
  );
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

  const {
    ammoShells,
    shellIdx,
    setActiveShell,
    isDirty: ammoDirty,
    reset: resetAmmo,
  } = useAmmo(active, modules, initialConfig.shell);

  const specs: TankSpec | null = useMemo(() => {
    if (!active) return stockSpecs;
    // Merge over the stock row so tank-level fields the derivation doesn't carry
    // (researchXp, description) survive; the config's values win for everything
    // it computes.
    return { ...(stockSpecs ?? {}), ...active.specs } as TankSpec;
  }, [active, stockSpecs]);

  const {
    equipped,
    roleCats,
    mounted,
    activeDirectives,
    mountedIcons,
    directives,
    appliedDirectives,
    appliedCrewDirectives,
    directiveCamo,
    consumables,
    consumableSlots,
    activeConsumableSlot,
    setActiveConsumableSlot,
    appliedConsumables,
    camoBonuses,
    equipmentCrewLevel,
    consumableCrewLevel,
    toggleEquip,
    assignEquip,
    setRoleCategory,
    toggleDirective,
    pickConsumable,
    equipmentDirty,
    resetEquipment,
    directivesDirty,
    resetDirectives,
    consumablesDirty,
    resetConsumables,
  } = useLoadout(loadout, {
    equipment: initialConfig.equipment,
    roleCats: initialConfig.roleCats,
    directives: initialConfig.directives,
    consumables: initialConfig.consumables,
  });
  const {
    selectedSkills,
    crewLevel,
    setCrewLevel,
    appliedCrewSkills,
    crewLevelIncrease,
    repairSkill,
    repairLevel,
    camoLevel,
    toggleCrewSkill,
    crewDirty,
    resetCrew,
  } = useCrewConfig(crew, {
    skills: initialConfig.crewSkills,
    level: initialConfig.crewLevel,
  });
  const {
    level: fieldModLevel,
    setLevel: setFieldModLevel,
    pairChoices,
    togglePair,
    appliedFieldMods,
    isDirty: fieldModsDirty,
    reset: resetFieldMods,
  } = useFieldMods(fieldMods, {
    level: initialConfig.fieldModLevel,
    pairs: initialConfig.fieldModPairs,
  });
  const {
    unlocked: unlockedNodes,
    isAvailable: isNodeAvailable,
    toggleNode,
    appliedSkillTree,
    isDirty: skillTreeDirty,
    reset: resetSkillTree,
  } = useSkillTree(skillTree, initialConfig.unlocked);

  // Characteristics reflect the selected shell first (it *replaces* base values:
  // damage, penetration, velocity, cost), then modules + equipment + directives
  // + consumables + crew skills scale on top. The shell must come first or a
  // multiplier on a per-shell stat (Perfect Charge's +10% shell velocity) would
  // be clobbered by the raw shell value.
  const finalSpecs: TankSpec | null = useMemo(() => {
    if (!specs) return specs;
    const withShell = applyShell(specs, ammoShells[shellIdx]);
    if (!withShell) return withShell;
    // The crew's major-qualification level (the slider) degrades every
    // crew-affected stat below 100%; nominal at 100%. Applied first, then the
    // trained skills/perks build on top.
    const withQual =
      crewLevel < 1 ? applyCrewQualification(withShell, crewLevel) : withShell;
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

  // The characteristics block, watched by the floating modified-stats recap so
  // it only shows while the table is scrolled out of view.
  const characteristicsRef = useRef<HTMLDivElement>(null);

  const showEquipment = !!loadout && loadout.equipment.length > 0;
  const showCrew =
    !!crew && crew.members.length > 0 && crew.skills.length > 0;
  const showDirectives = directives.length > 0;
  const showAmmo = ammoShells.length > 0;
  const showConsumables = consumables.length > 0;
  // The loadout block is two columns: ammunition + equipment + consumables +
  // directives + field modifications on the left, crew skills on the right. Each
  // column stacks its panels; the columns are independent heights.
  const leftCol =
    showAmmo ||
    showEquipment ||
    showConsumables ||
    showDirectives ||
    !!fieldMods;
  const rightCol = showCrew;

  function select(type: ModuleType, moduleId: number) {
    const slot = SLOT_BY_TYPE[type];
    if (!slot) return;
    if (active && active.modules[slot] === moduleId) return;
    // Every combination is valid, but a module may be incompatible with the
    // rest of the current selection (e.g. a gun that needs another turret).
    // Snap to the config that mounts this module and otherwise overlaps the
    // current selection the most.
    let best = -1;
    let bestScore = -1;
    configs.forEach((c, i) => {
      if (c.modules[slot] !== moduleId) return;
      const score = active ? overlap(c.modules, active.modules) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) setActiveIdx(best);
  }

  // Modules deviate from stock when a non-default configuration is selected;
  // resetting snaps back to the all-stock config.
  const modulesDirty = interactive && activeIdx !== stockIdx;
  const resetModules = () => setActiveIdx(stockIdx);

  // The whole-configurator reset (the "Reset all" button): every section back to
  // its default at once. `canResetAll` gates the button so it only shows when
  // something is actually modified.
  const canResetAll =
    ammoDirty ||
    equipmentDirty ||
    consumablesDirty ||
    directivesDirty ||
    fieldModsDirty ||
    skillTreeDirty ||
    crewDirty ||
    modulesDirty;
  function resetAll() {
    resetAmmo();
    resetEquipment();
    resetConsumables();
    resetDirectives();
    resetFieldMods();
    resetSkillTree();
    resetCrew();
    resetModules();
  }

  // The opaque token for the current selection (null when pristine). Shared by
  // the URL mirror and the "Share build" affordance so both stay in sync.
  const setupToken = useMemo(() => {
    const curModules = MODULE_SLOTS.map((s) => active?.modules[s] ?? null);
    const stockModules = MODULE_SLOTS.map(
      (s) => configs[stockIdx]?.modules[s] ?? null,
    );
    return encodeSetup({
      shell: shellIdx,
      modules: curModules,
      stockModules,
      equipment: equipped,
      roleCats,
      slots: loadout?.slots ?? [],
      consumables: consumableSlots,
      directives: [...activeDirectives],
      fieldModLevel,
      fieldModPairs: pairChoices,
      unlocked: [...unlockedNodes],
      crewSkills: [...selectedSkills],
      crewLevel,
    });
  }, [
    active,
    configs,
    stockIdx,
    loadout,
    shellIdx,
    equipped,
    roleCats,
    consumableSlots,
    activeDirectives,
    fieldModLevel,
    pairChoices,
    unlockedNodes,
    selectedSkills,
    crewLevel,
  ]);

  // Mirror the token into the URL (replaceState, so no navigation or scroll): a
  // pristine config writes no param, so the query stays empty until something is
  // touched and clears again on reset. Non-config params are kept.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete(SETUP_PARAM);
    if (setupToken) params.set(SETUP_PARAM, setupToken);
    const qs = params.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (url !== current) window.history.replaceState(null, "", url);
  }, [setupToken]);

  return (
    <>
      {finalSpecs && (
        <div ref={characteristicsRef}>
          <TankCharacteristics
            specs={finalSpecs}
            tankName={tankName}
            baseline={baselineSpec}
            canResetAll={canResetAll}
            onResetAll={resetAll}
            actions={
              setupToken ? (
                <BuildShare
                  region={region}
                  tankName={tankName}
                  slug={slug}
                  setupToken={setupToken}
                />
              ) : null
            }
          />
        </div>
      )}
      <CharacteristicsChanges
        specs={finalSpecs}
        baseline={baselineSpec}
        watch={characteristicsRef}
      />
      {finalSpecs && (leftCol || rightCol) && <PanelSeparator />}
      {(leftCol || rightCol) && (
        // Two columns: ammunition + consumables + directives + field mods on the
        // left, equipment + crew on the right. The wrapper draws the block's
        // full-width top/bottom lines once; the panels inside don't (they'd
        // double them), and a local under-title line separates each stacked one.
        // `items-stretch` makes both columns the same height, and a flex-1 filler
        // extends the shorter column's frame down to the block's bottom.
        <div
          className={cn(
            "screen-line-before screen-line-after",
            leftCol && rightCol && "grid grid-cols-2 items-stretch",
          )}
        >
          {leftCol && (
            <div className="flex flex-col">
              <div className="flex flex-col divide-y divide-fd-border">
                {showAmmo && (
                  <TankAmmo
                    shells={ammoShells}
                    active={shellIdx}
                    onSelect={setActiveShell}
                    dirty={ammoDirty}
                    onReset={resetAmmo}
                    screenLines={false}
                    headerBorder
                  />
                )}
                {showEquipment && (
                  <TankEquipment
                    loadout={loadout}
                    equipped={equipped}
                    roleCats={roleCats}
                    onToggle={toggleEquip}
                    onAssign={assignEquip}
                    onRoleCategory={setRoleCategory}
                    dirty={equipmentDirty}
                    onReset={resetEquipment}
                    screenLines={false}
                    headerBorder
                  />
                )}
                {showConsumables && (
                  <TankConsumables
                    consumables={consumables}
                    slots={consumableSlots}
                    activeSlot={activeConsumableSlot}
                    onSelectSlot={setActiveConsumableSlot}
                    onPick={pickConsumable}
                    dirty={consumablesDirty}
                    onReset={resetConsumables}
                    screenLines={false}
                    headerBorder
                  />
                )}
                {showDirectives && (
                  <TankDirectives
                    directives={directives}
                    mountedIcons={mountedIcons}
                    active={activeDirectives}
                    onToggle={toggleDirective}
                    dirty={directivesDirty}
                    onReset={resetDirectives}
                    screenLines={false}
                    headerBorder
                  />
                )}
                {fieldMods && (
                  <TankFieldModifications
                    fieldMods={fieldMods}
                    level={fieldModLevel}
                    onLevel={setFieldModLevel}
                    pairChoices={pairChoices}
                    onTogglePair={togglePair}
                    dirty={fieldModsDirty}
                    onReset={resetFieldMods}
                    screenLines={false}
                    headerBorder
                  />
                )}
              </div>
              <div aria-hidden className="flex-1 border-x border-fd-border" />
            </div>
          )}
          {rightCol && (
            <div className="flex flex-col">
              <div className="flex flex-col divide-y divide-fd-border">
                {showCrew && crew && (
                  <TankCrew
                    crew={crew}
                    selected={selectedSkills}
                    onToggle={toggleCrewSkill}
                    level={crewLevel}
                    onLevel={setCrewLevel}
                    dirty={crewDirty}
                    onReset={resetCrew}
                    screenLines={false}
                    headerBorder
                  />
                )}
              </div>
              <div aria-hidden className="flex-1 border-x border-fd-border" />
            </div>
          )}
        </div>
      )}
      {skillTree && (finalSpecs || leftCol || rightCol) && <PanelSeparator />}
      {skillTree && (
        <TankSkillTree
          skillTree={skillTree}
          tankName={tankName}
          unlocked={unlockedNodes}
          isAvailable={isNodeAvailable}
          onToggle={toggleNode}
          dirty={skillTreeDirty}
          onReset={resetSkillTree}
        />
      )}
      {(finalSpecs || leftCol || rightCol || skillTree) &&
        modules.length > 0 && <PanelSeparator />}
      {modules.length > 0 && (
        <TankModules
          region={region}
          meta={meta}
          nodes={modules}
          nextTanks={nextTanks}
          selectedModules={selectedModules}
          onSelectModule={interactive ? select : undefined}
          dirty={modulesDirty}
          onReset={resetModules}
        />
      )}
    </>
  );
}
