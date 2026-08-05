import Image from "next/image";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import { TankCost } from "@/components/tanks/detail/cost";
import { TankDetailTabs } from "@/components/tanks/detail/tab-bar";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { TankRender } from "@/components/tanks/detail/render";
import { TankActionsMenu } from "@/components/tanks/detail/actions-menu";
import { TankResearchPath } from "@/components/tanks/detail/specifications/research-path";
import ROUTES from "@/constants/routes";
import { TankConfigurator } from "@/components/tanks/detail/specifications/configurator";
import { TankMarksMastery } from "@/components/tanks/detail/marks/mastery";
import { Performances } from "./performances";
import type { MomValues } from "@unicum.gg/core/mom";
import type { MomHistoryPoint } from "@unicum.gg/core/mom/poliroid";
import type { MoeValues } from "@unicum.gg/core/moe";
import type { MoeHistoryPoint } from "@unicum.gg/core/moe/poliroid";
import { type TankSpec, type VehicleMeta, type VehicleMode, type WN8Expected, type WNXExpected, VEHICLE_CLASS_LABEL_FULL, VEHICLE_ROLE_LABEL, roleSuffix } from "@unicum.gg/shared";
import { VehicleRoleIcon } from "@/components/tanks/vehicle-role-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import { Region, REGION_LABEL, hangarBgUrl } from "@unicum.gg/wargaming";


export function TankView({
  region,
  tankId,
  slug,
  tab,
  meta,
  topByMetric,
  serverStats,
  wn8Expected,
  wnxExpected,
  specs,
  moe,
  mom,
  researchPath,
  modules,
  configs,
  loadout,
  crew,
  fieldMods,
  skillTree,
  modes,
  moeHistory,
  momHistory,
}: {
  region: Region;
  tankId: number;
  slug: string;
  tab: TankDetailTab;
  meta: VehicleMeta & { isWheeled?: boolean; isGift?: boolean };
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
  specs: TankSpec | null;
  moe: MoeValues | null;
  mom: MomValues | null;
  researchPath: ResearchBranch;
  modules: TankModuleNode[];
  configs: TankConfig[];
  loadout: TankLoadout | null;
  crew: TankCrew | null;
  fieldMods: TankFieldMods | null;
  skillTree: TankSkillTree | null;
  modes: VehicleMode[];
  moeHistory: MoeHistoryPoint[];
  momHistory: MomHistoryPoint[];
}) {
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const classLabel = VEHICLE_CLASS_LABEL_FULL[meta.type] ?? meta.type;
  const roleSfx = roleSuffix(meta.role);

  // Which tabs have something to show for this tank. Computed from the payload
  // rather than from rendered content, so an unavailable tab costs nothing.
  const hasSpecifications =
    Boolean(specs) || researchPath.lineage.length > 0 || modules.length > 0;
  const hasMarks = Boolean(moe || mom);
  const available = [
    ...(hasSpecifications ? [TankDetailTab.Specifications] : []),
    TankDetailTab.Performances,
    ...(hasMarks ? [TankDetailTab.Marks] : []),
  ];
  // A tank missing the requested tab falls back to the first one it does have.
  const activeTab = available.includes(tab) ? tab : available[0];

  const favoriteItem: SearchHistoryItem = {
    kind: "tank",
    region,
    tank: {
      tank_id: tankId,
      slug,
      name: meta.name,
      short_name: meta.shortName,
      tag: meta.tag,
      tier: meta.tier,
      nation: meta.nation,
      type: meta.type,
      is_premium: meta.isPremium,
    },
  };


  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel className="border-b border-fd-border">
        {/* The hero is always dark, in both themes. It sits on the hangar
            photo, which is dark whatever the theme, so the fades below have to
            darken rather than lighten: in light mode `fd-background` is
            hsl(0,0%,96%) and the gradient washed the whole thing out in white.
            Carrying the `dark` class re-resolves every design token inside this
            subtree to its dark value, so the fades, the spotlight and the text
            colors move together (a fade-only fix would leave the dark title
            unreadable). `text-fd-foreground` is needed because `color` is
            inherited as a computed value from `body`, so it would not pick the
            re-resolved token on its own. */}
        <div className="dark relative min-h-[300px] overflow-hidden text-fd-foreground sm:min-h-0 sm:aspect-[32/15]">
          {/* The exact hangar-floor backdrop WG's own tankopedia detail page
              uses (1920x900, matching the render), served from its portal CDN.
              `latest` keeps the URL stable across client version bumps. Rendered
              through next/image so it is resized/format-negotiated instead of
              shipping the full-size webp as a CSS background. */}
          <Image
            src={hangarBgUrl(region, "webp")}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="pointer-events-none object-cover object-center"
          />
          {/* Soft spotlight behind the vehicle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_66%_at_57%_36%,var(--color-fd-secondary)/45%,transparent_72%)]"
          />
          {/* High-res vehicle render, full-bleed (gunmarks / skill4ltu style). */}
          <div className="pointer-events-none absolute inset-0">
            <TankRender
              tag={meta.tag}
              region={region}
              slug={slug}
              name={meta.name}
            />
          </div>
          {/* Left fade keeps the title legible over the render. Kept tight to
              the left (clears by ~58%) so it darkens the title area, not the
              vehicle render sitting in the centre. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-r from-fd-background from-0% via-fd-background/30 via-26% to-transparent to-58%"
          />
          {/* Wrap the fade around the top-left corner (diagonal from that
              corner) so the header labels sit on the same darkening, not just
              the left edge. Clears before the centre so the render stays lit. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-fd-background from-0% via-fd-background/20 via-28% to-transparent to-55%"
          />
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
            <TankActionsMenu
              region={region}
              tankId={tankId}
              tag={meta.tag}
              name={meta.name}
              slug={slug}
              favoriteItem={favoriteItem}
            />
          </div>
          {specs && (
            <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
              <TankCost
                specs={specs}
                region={region}
                isReward={meta.isReward}
              />
            </div>
          )}
          <div className="relative z-10 space-y-2 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
              <span className="font-semibold text-brand">{tierLabel}</span>
              <NationFlag nation={meta.nation} region={region} variant="flag" />
              <VehicleTypeIcon type={meta.type} premium={meta.isPremium} />
              <span>{classLabel}</span>
              {roleSfx && (
                <span className="flex items-center gap-1">
                  <VehicleRoleIcon role={roleSfx} size={14} />
                  {VEHICLE_ROLE_LABEL[roleSfx]}
                </span>
              )}
              {meta.isReward ? (
                <span className="text-[#4FC4D9]">Reward</span>
              ) : meta.isPremium ? (
                <span className="text-[#FAB81B]">Premium</span>
              ) : null}
            </div>
            <h1 className="max-w-sm font-heading text-4xl font-bold tracking-tight md:text-5xl">
              {meta.name}
            </h1>
            <p className="max-w-sm text-sm text-fd-muted-foreground">
              World of Tanks {REGION_LABEL[region]} statistics for the{" "}
              {tierLabel} {meta.nation.toUpperCase()} {classLabel.toLowerCase()}{" "}
              {meta.name}.
            </p>
          </div>
        </div>
      </Panel>

      <PanelSeparator />

      <TankDetailTabs
        basePath={ROUTES.TANK(region, slug)}
        active={activeTab}
        available={available}
      />

      {activeTab === TankDetailTab.Specifications && (
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
          {researchPath.lineage.length > 0 &&
            (specs || modules.length > 0) && <PanelSeparator />}
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
        </>
      )}

      {activeTab === TankDetailTab.Performances && (
        <Performances
          region={region}
          tankId={tankId}
          meta={meta}
          serverStats={serverStats}
          topByMetric={topByMetric}
          wn8Expected={wn8Expected}
          wnxExpected={wnxExpected}
        />
      )}

      {activeTab === TankDetailTab.Marks && (moe || mom) && (
        <TankMarksMastery
          moe={moe}
          mom={mom}
          moeHistory={moeHistory}
          momHistory={momHistory}
          serverStats={serverStats}
          tankName={meta.name}
        />
      )}
    </div>
  );
}

