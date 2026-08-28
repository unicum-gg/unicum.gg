import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TankConfigurator } from "@/components/tanks/detail/specifications/configurator";
import { TankResearchPath } from "@/components/tanks/detail/specifications/research-path";
import { SimilarTanks } from "@/components/tanks/detail/similar";
import { TankVideosPreview } from "@/components/tanks/detail/videos";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { TankSpec, VehicleMeta, VehicleMode } from "@unicum.gg/shared";
import type { SimilarTankRow } from "@/app/api/[region]/tanks/[slug]/similar/schema.api";
import type { Region } from "@unicum.gg/wargaming";

/** What the vehicle is: where it sits in its line, what it is made of, and what
 * it was. The default tab, and the one most of a tank page is read on. */
export function SpecificationsTab({
  region,
  slug,
  tankId,
  meta,
  specs,
  modules,
  configs,
  loadout,
  crew,
  fieldMods,
  skillTree,
  modes,
  researchPath,
  videos,
  similar,
  testVersion,
}: {
  region: Region;
  slug: string;
  tankId: number;
  meta: VehicleMeta;
  specs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  loadout: TankLoadout | null;
  crew: TankCrew | null;
  fieldMods: TankFieldMods | null;
  skillTree: TankSkillTree | null;
  modes: VehicleMode[];
  researchPath: ResearchBranch;
  videos: TankVideoCardData[];
  /** The vehicles that play like this one. Empty when it cannot be placed. */
  similar: SimilarTankRow[];
  /** The Common Test build that rebalances this vehicle, null when none does. */
  testVersion: string | null;
}) {
  return (
    <>
      {researchPath.lineage.length > 0 && (
        <TankResearchPath
          region={region}
          lineage={researchPath.lineage}
          next={researchPath.next}
          currentId={tankId}
          tankName={meta.name}
        />
      )}
      {researchPath.lineage.length > 0 && (specs || modules.length > 0) && (
        <PanelSeparator />
      )}
      {(specs || modules.length > 0) && (
        <TankConfigurator
          region={region}
          meta={meta}
          tankName={meta.name}
          slug={slug}
          stockSpecs={specs}
          modules={modules}
          configs={configs}
          loadout={loadout}
          crew={crew}
          fieldMods={fieldMods}
          skillTree={skillTree}
          modes={modes}
          nextTanks={researchPath.next}
          testVersion={testVersion}
        />
      )}
      {specs?.description && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{meta.name} historical reference</PanelTitle>
            </PanelHeader>
            <PanelContent className="px-4 py-4">
              <p className="max-w-3xl text-sm leading-relaxed text-fd-muted-foreground">
                {specs.description}
              </p>
            </PanelContent>
          </Panel>
        </>
      )}
      {/* The tab is the full list; this is what makes anyone discover it. Most
          of a tank page is read here, and a section nobody sees collects no
          suggestions, which is what the feature runs on, so it shows even with
          nothing in it: the empty state is the invitation to add the first. */}
      <PanelSeparator />
      <TankVideosPreview
        region={region}
        slug={slug}
        tankName={meta.name}
        videos={videos}
      />
      {/* Last, deliberately: it is the section that sends the reader somewhere
          else, so it comes after everything this page had to say. */}
      {similar.length > 0 && (
        <>
          <PanelSeparator />
          <SimilarTanks
            region={region}
            slug={slug}
            tankName={meta.name}
            results={similar}
          />
        </>
      )}
    </>
  );
}
