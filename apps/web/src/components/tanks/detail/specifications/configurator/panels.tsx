"use client";

import type { TankCrew as TankCrewData } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods as TankFieldModsData } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import { TankAmmo } from "@/components/tanks/detail/specifications/ammo";
import { TankConsumables } from "@/components/tanks/detail/specifications/consumables";
import { TankCrew } from "@/components/tanks/detail/specifications/crew";
import { TankDirectives } from "@/components/tanks/detail/specifications/directives";
import { TankEquipment } from "@/components/tanks/detail/specifications/equipment";
import { TankFieldModifications } from "@/components/tanks/detail/specifications/field-mods";
import type { TankBuild } from "@/hooks/use-tank-build";
import { cn } from "@/lib/utils";

/** How the panels are laid out: a page gives them the two columns they were
 * designed for, a comparison column stacks them in its narrower drawer. */
export enum LoadoutLayout {
  Columns = "columns",
  Stacked = "stacked",
}

/** Which sections a vehicle actually has something to show for. */
export function loadoutSections(
  build: TankBuild,
  loadout: TankLoadout | null,
  crew: TankCrewData | null,
  fieldMods: TankFieldModsData | null,
) {
  const ammo = build.ammo.ammoShells.length > 0;
  const equipment = !!loadout && loadout.equipment.length > 0;
  const consumables = build.loadout.consumables.length > 0;
  const directives = build.loadout.directives.length > 0;
  const crewSkills = !!crew && crew.members.length > 0 && crew.skills.length > 0;
  return {
    ammo,
    equipment,
    consumables,
    directives,
    fieldMods: !!fieldMods,
    crew: crewSkills,
    left: ammo || equipment || consumables || directives || !!fieldMods,
    right: crewSkills,
  };
}

/**
 * Everything you mount on a vehicle: ammunition, equipment, consumables,
 * directives and field modifications on one side, crew skills on the other.
 *
 * Split out of the configurator so a comparison column mounts the exact same
 * panels the tank page does, wired to its own build. `layout` is the only
 * difference between the two.
 */
export function TankLoadoutPanels({
  build,
  loadout,
  crew,
  fieldMods,
  layout = LoadoutLayout.Columns,
}: {
  build: TankBuild;
  loadout: TankLoadout | null;
  crew: TankCrewData | null;
  fieldMods: TankFieldModsData | null;
  layout?: LoadoutLayout;
}) {
  const show = loadoutSections(build, loadout, crew, fieldMods);
  if (!show.left && !show.right) return null;
  const { ammo, loadout: lo, crew: cr, fieldMods: fm } = build;

  const leftPanels = (
    <>
      {show.ammo && (
        <TankAmmo
          shells={ammo.ammoShells}
          active={ammo.shellIdx}
          onSelect={ammo.setActiveShell}
          dirty={ammo.isDirty}
          onReset={ammo.reset}
          screenLines={false}
          headerBorder
        />
      )}
      {show.equipment && loadout && (
        <TankEquipment
          loadout={loadout}
          equipped={lo.equipped}
          roleCats={lo.roleCats}
          onToggle={lo.toggleEquip}
          onAssign={lo.assignEquip}
          onRoleCategory={lo.setRoleCategory}
          dirty={lo.equipmentDirty}
          onReset={lo.resetEquipment}
          screenLines={false}
          headerBorder
        />
      )}
      {show.consumables && (
        <TankConsumables
          consumables={lo.consumables}
          slots={lo.consumableSlots}
          activeSlot={lo.activeConsumableSlot}
          onSelectSlot={lo.setActiveConsumableSlot}
          onPick={lo.pickConsumable}
          dirty={lo.consumablesDirty}
          onReset={lo.resetConsumables}
          screenLines={false}
          headerBorder
        />
      )}
      {show.directives && (
        <TankDirectives
          directives={lo.directives}
          mountedIcons={lo.mountedIcons}
          active={lo.activeDirectives}
          onToggle={lo.toggleDirective}
          dirty={lo.directivesDirty}
          onReset={lo.resetDirectives}
          screenLines={false}
          headerBorder
        />
      )}
      {show.fieldMods && fieldMods && (
        <TankFieldModifications
          fieldMods={fieldMods}
          level={fm.level}
          onLevel={fm.setLevel}
          pairChoices={fm.pairChoices}
          onTogglePair={fm.togglePair}
          dirty={fm.isDirty}
          onReset={fm.reset}
          screenLines={false}
          headerBorder
        />
      )}
    </>
  );

  const rightPanels = show.crew && crew && (
    <TankCrew
      crew={crew}
      selected={cr.selectedSkills}
      onToggle={cr.toggleCrewSkill}
      level={cr.crewLevel}
      onLevel={cr.setCrewLevel}
      dirty={cr.crewDirty}
      onReset={cr.resetCrew}
      screenLines={false}
      headerBorder
    />
  );

  // Stacked (a comparison column's drawer): everything runs down one column,
  // separated by its own rules, with no page-wide screen lines around it.
  if (layout === LoadoutLayout.Stacked) {
    return (
      <div className="flex flex-col divide-y divide-fd-border">
        {leftPanels}
        {rightPanels}
      </div>
    );
  }

  // The wrapper draws the block's full-width top/bottom lines once (the panels
  // inside don't, they'd double them), and a local under-title line separates
  // each stacked one. With both columns, `items-stretch` makes them the same
  // height and a flex-1 filler extends the shorter one's frame to the bottom.
  // One column on narrow screens so Crew Skills stacks below the left block
  // instead of being cramped beside it; side by side from `lg`. Stacked, a
  // horizontal rule separates the two (matching the left block's own `divide-y`);
  // at `lg` the vertical column frame takes over, so the rule is dropped.
  return (
    <div
      className={cn(
        "screen-line-before screen-line-after",
        show.left &&
          show.right &&
          "grid grid-cols-1 items-stretch divide-y divide-fd-border lg:grid-cols-2 lg:divide-y-0",
      )}
    >
      {show.left && (
        <div className="flex flex-col">
          <div className="flex flex-col divide-y divide-fd-border">{leftPanels}</div>
          <div aria-hidden className="flex-1 border-x border-fd-border" />
        </div>
      )}
      {show.right && (
        <div className="flex flex-col">
          <div className="flex flex-col divide-y divide-fd-border">{rightPanels}</div>
          <div aria-hidden className="flex-1 border-x border-fd-border" />
        </div>
      )}
    </div>
  );
}
