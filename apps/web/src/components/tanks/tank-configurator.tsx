"use client";

import { useMemo, useState } from "react";
import { ModuleType, type Region } from "@unicum.gg/wargaming";
import type { VehicleMeta, TankSpec } from "@unicum.gg/shared";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type {
  TankConfig,
  TankConfigModules,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import { TankCharacteristics } from "@/components/tanks/tank-characteristics";
import { TankModules } from "@/components/tanks/tank-modules";
import { PanelSeparator } from "@/components/panel";

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

// Fields that distinguish configurations, used to identify the config matching
// the stored top-config `specs` row so the page opens on the fully-upgraded
// tank (as it does today) with the top modules highlighted.
const MATCH_FIELDS: (keyof TankSpec)[] = [
  "damage",
  "penetration",
  "enginePower",
  "hullTraverse",
  "turretTraverse",
  "radioRange",
  "viewRange",
];

function specDistance(a: TankSpec, b: TankConfig["specs"]): number {
  return MATCH_FIELDS.reduce((sum, f) => {
    const x = (a[f] as number | null) ?? 0;
    const y = (b[f as keyof TankConfig["specs"]] as number | null) ?? 0;
    return sum + (x - y) ** 2;
  }, 0);
}

/**
 * The Characteristics + Modules blocks, linked: the stock modules start
 * selected and picking a module re-renders the characteristics from that
 * combination. When there are no configs (wot-src has nothing for the tank) it
 * degrades to the static stock specs + a non-interactive module tree.
 */
export function TankConfigurator({
  region,
  meta,
  tankName,
  stockSpecs,
  modules,
  configs,
  nextTanks,
}: {
  region: Region;
  meta: VehicleMeta;
  tankName: string;
  stockSpecs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  nextTanks: ResearchPathItem[];
}) {
  const interactive = configs.length > 0;

  // Index of the config matching the stored top-config specs, so the page opens
  // on the fully-upgraded tank (unchanged from today) with the top modules
  // highlighted. Falls back to the first config when there is no stored row.
  const defaultIdx = useMemo(() => {
    if (!interactive) return 0;
    if (!stockSpecs) return 0;
    let best = 0;
    let bestDist = Infinity;
    configs.forEach((c, i) => {
      const d = specDistance(stockSpecs, c.specs);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [configs, stockSpecs, interactive]);

  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const active = interactive ? configs[activeIdx] : null;

  const selectedModules = active?.modules ?? null;

  const specs: TankSpec | null = useMemo(() => {
    if (!active) return stockSpecs;
    // Merge over the stock row so tank-level fields the derivation doesn't carry
    // (researchXp, description) survive; the config's values win for everything
    // it computes.
    return { ...(stockSpecs ?? {}), ...active.specs } as TankSpec;
  }, [active, stockSpecs]);

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

  return (
    <>
      {specs && (
        <TankCharacteristics
          specs={specs}
          tankName={tankName}
          baseline={interactive ? stockSpecs : null}
        />
      )}
      {specs && modules.length > 0 && <PanelSeparator />}
      {modules.length > 0 && (
        <TankModules
          region={region}
          meta={meta}
          nodes={modules}
          nextTanks={nextTanks}
          selectedModules={selectedModules}
          onSelectModule={interactive ? select : undefined}
        />
      )}
    </>
  );
}
