"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Region } from "@unicum.gg/wargaming";
import type { VehicleMeta, VehicleMode, TankSpec } from "@unicum.gg/shared";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankCrew as TankCrewData } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods as TankFieldModsData } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankSkillTree as TankSkillTreeData } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import { TankCharacteristics } from "@/components/tanks/detail/specifications/characteristics";
import { TankConfiguratorSkeleton } from "@/components/tanks/detail/specifications/configurator/skeleton";
import {
  loadoutSections,
  TankLoadoutPanels,
} from "@/components/tanks/detail/specifications/configurator/panels";
import { CharacteristicsChanges } from "@/components/tanks/detail/specifications/characteristics/changes-overlay";
import { TankModules } from "@/components/tanks/detail/specifications/modules";
import { TankSkillTree } from "@/components/tanks/detail/specifications/skill-tree";
import { VehicleModeToggle } from "@/components/tanks/detail/specifications/vehicle-mode";
import { PanelSeparator } from "@/components/panel";
import { useTankBuild } from "@/hooks/use-tank-build";
import {
  decodeSetup,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";
import { BuildShare } from "@/components/tanks/detail/specifications/build-share";
import { CompareWithTank } from "@/components/tanks/detail/specifications/compare-with-tank";
import { CopyToTank } from "@/components/tanks/detail/specifications/copy-to-tank";

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
  modes: VehicleMode[];
  nextTanks: ResearchPathItem[];
};

// The stateful configurator can't be threaded with a `loading` flag (its hooks
// would break the rules-of-hooks early return), so the loading twin is a thin
// wrapper that swaps in the co-located skeleton before any hook runs.
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
  modes,
  nextTanks,
}: TankConfiguratorProps) {
  // A shared setup rides in the query string: decode it once (SSR and client see
  // the same params, so the initial render matches), seed every section from it,
  // and mirror later edits back into the URL so the link stays shareable.
  const searchParams = useSearchParams();
  const [initialConfig] = useState(() =>
    decodeSetup(searchParams.get(SETUP_PARAM)),
  );

  const build = useTankBuild(
    { stockSpecs, modules, configs, loadout, crew, fieldMods, skillTree, modes },
    initialConfig,
  );
  const { finalSpecs, baselineSpec, setupToken } = build;

  // The characteristics block, watched by the floating modified-stats recap so
  // it only shows while the table is scrolled out of view.
  const characteristicsRef = useRef<HTMLDivElement>(null);

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

  const sections = loadoutSections(build, loadout, crew, fieldMods);
  const hasPanels = sections.left || sections.right;

  return (
    <>
      {finalSpecs && (
        <div ref={characteristicsRef}>
          <TankCharacteristics
            specs={finalSpecs}
            tankName={tankName}
            baseline={baselineSpec}
            canResetAll={build.canResetAll}
            onResetAll={build.resetAll}
            titleControl={
              <VehicleModeToggle
                modes={modes}
                active={build.mode.active}
                onToggle={build.mode.toggle}
              />
            }
            actions={
              <div className="flex items-center gap-1.5">
                {setupToken && (
                  <>
                    <BuildShare
                      region={region}
                      tankName={tankName}
                      slug={slug}
                      setupToken={setupToken}
                    />
                    <CopyToTank
                      region={region}
                      slug={slug}
                      setupToken={setupToken}
                    />
                  </>
                )}
                {/* Always offered, setup or not: comparing this vehicle against
                    another is what the page is read for as often as building it,
                    and the current build rides along when there is one. */}
                <CompareWithTank
                  region={region}
                  slug={slug}
                  setupToken={build.portableSetupToken}
                />
              </div>
            }
          />
        </div>
      )}
      <CharacteristicsChanges
        specs={finalSpecs}
        baseline={baselineSpec}
        watch={characteristicsRef}
      />
      {finalSpecs && hasPanels && <PanelSeparator />}
      {hasPanels && (
        <TankLoadoutPanels
          build={build}
          loadout={loadout}
          crew={crew}
          fieldMods={fieldMods}
        />
      )}
      {skillTree && (finalSpecs || hasPanels) && <PanelSeparator />}
      {skillTree && (
        <TankSkillTree
          skillTree={skillTree}
          tankName={tankName}
          unlocked={build.skillTree.unlocked}
          isAvailable={build.skillTree.isAvailable}
          onToggle={build.skillTree.toggleNode}
          dirty={build.skillTree.isDirty}
          onReset={build.skillTree.reset}
        />
      )}
      {(finalSpecs || hasPanels || skillTree) && modules.length > 0 && (
        <PanelSeparator />
      )}
      {modules.length > 0 && (
        <TankModules
          region={region}
          meta={meta}
          nodes={modules}
          nextTanks={nextTanks}
          selectedModules={build.selectedModules}
          onSelectModule={build.interactive ? build.select : undefined}
          dirty={build.modulesDirty}
          onReset={build.resetModules}
        />
      )}
    </>
  );
}
