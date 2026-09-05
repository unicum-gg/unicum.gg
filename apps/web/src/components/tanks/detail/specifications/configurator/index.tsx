"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBuildLink } from "@/components/tanks/detail/build-context";
import type { Region } from "@unicum.gg/wargaming";
import {
  TankClient,
  toTankClient,
  type VehicleMeta,
  type VehicleMode,
  type TankSpec,
} from "@unicum.gg/shared";
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
  CLIENT_PARAM,
  decodeSetup,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";
import { TankClientSwitch } from "@/components/tanks/detail/specifications/common-test";
import { CompareClients } from "@/components/tanks/detail/specifications/common-test/compare-clients";
import { useTestBuild } from "@/components/tanks/detail/specifications/common-test/use-test-build";
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
  /** Which mechanic the vehicle's second state is, where it has one. */
  mechanic?: string | null;
  nextTanks: ResearchPathItem[];
  /** The Common Test build that rebalances this vehicle, null when none does.
   * Its presence is what offers the reader the test client's numbers. */
  testVersion: string | null;
};

// The stateful configurator can't be threaded with a `loading` flag (its hooks
// would break the rules-of-hooks early return), so the loading twin is a thin
// wrapper that swaps in the co-located skeleton before any hook runs.
export function TankConfigurator(
  props: { loading: true } | TankConfiguratorProps,
) {
  if ("loading" in props) return <TankConfiguratorSkeleton />;
  return <TankConfiguratorClient {...props} />;
}

/**
 * Which game client the vehicle below is built from.
 *
 * The page is served on the live one and the test build is fetched only if
 * someone asks for it, so this layer owns that choice: the switch, the fetch,
 * and the `?client=ct` in the URL that makes the choice shareable.
 *
 * Switching remounts the configurator, which is what makes the swap clean: every
 * section reseeds from the new client's data instead of holding indices into the
 * previous one. The setup survives it because it is carried across as the same
 * token a shared link uses, and that token names modules by id, so it lands on
 * the right configuration even if the test build changed the module list.
 */
function TankConfiguratorClient(props: TankConfiguratorProps) {
  const { region, slug, meta, testVersion } = props;
  const searchParams = useSearchParams();
  // A vehicle that exists only on the test client is already being served from
  // it, and has no live version to switch to.
  const switchable = Boolean(testVersion) && !meta.isCommonTest;
  const [client, setClient] = useState<TankClient>(() =>
    switchable ? toTankClient(searchParams.get(CLIENT_PARAM)) : TankClient.Live,
  );
  const wanted = client === TankClient.CommonTest;
  const { data: testBuild, pending, failed, retry } = useTestBuild(
    region,
    slug,
    wanted,
  );

  // Until the test payload lands, the live one stays on screen, and a fetch that
  // failed leaves the reader on it rather than on a vehicle that is neither. So
  // what is shown is derived from the data in hand, never from the intent alone.
  const showing = wanted && testBuild ? testBuild : null;
  const effectiveClient = showing ? TankClient.CommonTest : TankClient.Live;

  // The setup the reader has assembled, mirrored out of the configurator so it
  // can be handed back to the remounted one.
  const setupRef = useRef<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const select = useCallback(
    (next: TankClient) => {
      if (next === client) {
        // Re-picking the client already asked for only means one thing: the
        // fetch failed and the reader is asking again.
        if (failed) retry();
        return;
      }
      setSeed(setupRef.current);
      setClient(next);
    },
    [client, failed, retry],
  );
  const onSetupTokenChange = useCallback((token: string | null) => {
    setupRef.current = token;
  }, []);

  // Live leaves the URL clean; the test client writes itself into it so the link
  // opens on the same vehicle. Keyed on what is actually on screen, so the URL
  // never advertises a build the page failed to load. `replaceState`, like the
  // setup token, so a switch is not a navigation and does not stack history.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete(CLIENT_PARAM);
    if (effectiveClient === TankClient.CommonTest)
      params.set(CLIENT_PARAM, effectiveClient);
    const qs = params.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, "", url);
  }, [effectiveClient]);

  return (
    <TankConfiguratorInner
      {...props}
      {...(showing ?? {})}
      // Remount on the client actually being shown, not the one asked for, so
      // the swap happens when the data does.
      key={effectiveClient}
      initialSetup={seed}
      onSetupTokenChange={onSetupTokenChange}
      clientSwitch={
        switchable ? (
          <TankClientSwitch
            client={effectiveClient}
            testVersion={testVersion}
            pending={pending}
            onSelect={select}
          />
        ) : null
      }
    />
  );
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
  mechanic,
  nextTanks,
  testVersion,
  initialSetup,
  onSetupTokenChange,
  clientSwitch,
}: TankConfiguratorProps & {
  /** Setup to open on, winning over the URL. Set when the game client was
   * switched, so the build carries across the remount. */
  initialSetup?: string | null;
  onSetupTokenChange?: (token: string | null) => void;
  clientSwitch?: React.ReactNode;
}) {
  // A shared setup rides in the query string: decode it once (SSR and client see
  // the same params, so the initial render matches), seed every section from it,
  // and mirror later edits back into the URL so the link stays shareable.
  const searchParams = useSearchParams();
  const [initialConfig] = useState(() =>
    decodeSetup(initialSetup ?? searchParams.get(SETUP_PARAM)),
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

  // Reported up so a switch of game client can hand the same setup to the
  // configurator it remounts.
  useEffect(() => {
    onSetupTokenChange?.(setupToken);
  }, [setupToken, onSetupTokenChange]);

  // And handed to the hero, whose own compare control has to take the build on
  // screen with it. The portable one, since a comparison column opens on the
  // top configuration where this page opens on stock.
  const { publish } = useBuildLink();
  useEffect(() => {
    publish(build.portableSetupToken);
  }, [build.portableSetupToken, publish]);

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
              <>
                {clientSwitch}
                <VehicleModeToggle
                  modes={modes}
                  mechanic={mechanic}
                  active={build.mode.active}
                  onToggle={build.mode.toggle}
                />
              </>
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
                {/* Only while a test is running, and next to the general
                    comparison for the same reason it exists: the most useful
                    thing to read this vehicle against, right now, is itself. */}
                <CompareClients
                  region={region}
                  slug={slug}
                  testVersion={testVersion}
                  setupToken={build.portableSetupToken}
                />
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
