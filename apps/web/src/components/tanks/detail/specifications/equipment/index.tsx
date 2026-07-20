"use client";

import { useState } from "react";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResetButton } from "@/components/tanks/detail/specifications/reset-button";
import { SlotBox } from "./slot-box";
import { DeviceBox } from "./device-box";
import { CategoryGlyph } from "./category-glyph";
import {
  CATEGORY,
  cycleHint,
  experimentalLevel,
  slotCategory,
  earnsCategoryBonus,
  type Equipment,
} from "./category";

/**
 * The tank's Equipment 2.0 loadout: a row of its slots on top (each mounted
 * device gets its bonus "+" when the slot category matches; the role slot can
 * switch category), and a grid of every compatible device below. Clicking a
 * device in the grid mounts it in the best-fitting free slot (or removes it),
 * and hovering shows its full effects. The parent applies the mounted devices
 * to the characteristics.
 */
export function TankEquipment({
  loadout,
  equipped,
  roleCats,
  onToggle,
  onAssign,
  onRoleCategory,
  dirty = false,
  onReset,
  screenLines = true,
  headerBorder = false,
}: {
  loadout: TankLoadout;
  /** The equipment key mounted in each slot (null = empty). */
  equipped: (string | null)[];
  /** The chosen category of each slot (only meaningful for role slots). */
  roleCats: (string | null)[];
  /** Mount the device in its best free slot, or remove it if already mounted. */
  onToggle: (key: string) => void;
  /** Mount the device in a specific slot (right-click "Add to slot N"). */
  onAssign: (key: string, slotIndex: number) => void;
  /** Set the configurable slot's category (null clears it — it's optional). */
  onRoleCategory: (slotIndex: number, category: string | null) => void;
  /** Whether the section deviates from its default (shows the reset button). */
  dirty?: boolean;
  /** Reset the section to its default (no device mounted, no chosen category). */
  onReset?: () => void;
  /** The decorative full-width edge lines; disable when beside another panel. */
  screenLines?: boolean;
  /** A local under-title line (column-width), when stacked below another panel. */
  headerBorder?: boolean;
}) {
  const byKey = new Map(loadout.equipment.map((e) => [e.key, e]));

  // The selected slot: there is always one, so picking equipment always has a
  // target. Pick a slot, then pick the equipment that goes in it.
  const [activeSlot, setActiveSlot] = useState(0);
  const activeCat = loadout.slots[activeSlot]
    ? slotCategory(loadout.slots[activeSlot], roleCats[activeSlot])
    : null;

  // Devices grouped by family (icon) and grade; experimental combos stand
  // alone. The grid shows one cell per family and clicking it walks up the grade
  // ladder, so there is a single row instead of one row per grade tier.
  const FAMILY_GRADES = ["standard", "bounty", "bountyUpgraded", "bond"] as const;
  const byFamilyGrade = new Map<string, Map<string, Equipment>>();
  const families: string[] = [];
  for (const e of loadout.equipment) {
    if (e.grade === "experimental") continue;
    if (!byFamilyGrade.has(e.icon)) byFamilyGrade.set(e.icon, new Map());
    byFamilyGrade.get(e.icon)!.set(e.grade, e);
  }
  for (const grade of FAMILY_GRADES) {
    for (const e of loadout.equipment) {
      if (e.grade === grade && !families.includes(e.icon)) families.push(e.icon);
    }
  }
  // Experimental combos, grouped by icon into their 1/2/3 upgrade levels.
  const expFamilies: string[] = [];
  const expByIcon = new Map<string, Equipment[]>();
  for (const e of loadout.equipment) {
    if (e.grade !== "experimental") continue;
    if (!expByIcon.has(e.icon)) {
      expByIcon.set(e.icon, []);
      expFamilies.push(e.icon);
    }
    expByIcon.get(e.icon)!.push(e);
  }
  for (const list of expByIcon.values())
    list.sort((a, b) => experimentalLevel(a) - experimentalLevel(b));

  // A family's grade variants in ascending strength (only those it actually has).
  const familyGrades = (icon: string): Equipment[] =>
    FAMILY_GRADES.map((g) => byFamilyGrade.get(icon)?.get(g)).filter(
      (e): e is Equipment => !!e,
    );
  // The mounted device of a family (in any slot), or null.
  const mountedOf = (icon: string): Equipment | null => {
    for (const k of equipped) {
      const e = k ? byKey.get(k) : undefined;
      if (e && e.icon === icon) return e;
    }
    return null;
  };
  // Click a device cell: mount its first variant, then step up one variant each
  // click, and remove it past the last (std -> bounty -> bounty+ -> bond -> off
  // for a family; level 1 -> 2 -> 3 -> off for experimental).
  const cycleVariants = (icon: string, variants: Equipment[]) => {
    if (variants.length === 0) return;
    const cur = mountedOf(icon);
    if (!cur) {
      onAssign(variants[0].key, activeSlot); // mount into the selected slot
      return;
    }
    const idx = variants.findIndex((v) => v.key === cur.key);
    if (idx >= 0 && idx < variants.length - 1) {
      onAssign(variants[idx + 1].key, equipped.indexOf(cur.key)); // step up
    } else {
      onToggle(cur.key); // past the last variant: remove
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Panel screenLines={screenLines}>
        <PanelHeader
          screenLines={screenLines}
          className={cn(
            "flex items-center justify-between gap-4",
            headerBorder && "border-b border-fd-border",
          )}
        >
          <PanelTitle>Equipment</PanelTitle>
          {dirty && onReset ? <ResetButton onReset={onReset} /> : null}
        </PanelHeader>
        <PanelContent className="space-y-5 px-4 py-6">
          <div className="flex flex-wrap gap-3">
            {loadout.slots.map((slot, i) => {
              const equip = equipped[i] ? byKey.get(equipped[i]!) ?? null : null;
              const cat = slotCategory(slot, roleCats[i]);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveSlot(i)}
                    aria-pressed={activeSlot === i}
                    aria-label={`Slot ${i + 1}${equip ? `: ${equip.name}` : ""}`}
                    className={cn(
                      "cursor-pointer rounded-lg transition-shadow",
                      activeSlot === i
                        ? "ring-2 ring-[#f25322] ring-offset-2 ring-offset-fd-background"
                        : "",
                    )}
                  >
                    <SlotBox slot={slot} roleCat={roleCats[i]} equip={equip} />
                  </button>
                  {slot.role && slot.roleOptions && slot.roleOptions.length > 1 ? (
                    <div className="flex gap-1">
                      {slot.roleOptions.map((opt) => {
                        const c = CATEGORY[opt];
                        const active = roleCats[i] === opt;
                        return (
                          <Tooltip key={opt}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() =>
                                  onRoleCategory(i, active ? null : opt)
                                }
                                aria-label={c?.label ?? opt}
                                className={cn(
                                  "flex size-5 items-center justify-center rounded transition-opacity",
                                  active ? "" : "opacity-40 hover:opacity-75",
                                )}
                                style={active ? { backgroundColor: c?.color } : undefined}
                              >
                                {c ? (
                                  <CategoryGlyph
                                    category={opt}
                                    className="size-3.5"
                                    color={active ? "#fff" : c.color}
                                  />
                                ) : null}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-0.5 text-xs">
                                <div className="font-medium">
                                  {c?.label ?? opt}
                                </div>
                                <div className="text-background/60">
                                  {active
                                    ? "Click to clear this slot's specialization."
                                    : "Click to specialize this slot."}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : cat ? (
                    // Match the role-slot buttons' size-5 box so the glyph row
                    // lines up across slots (a bare glyph would sit higher).
                    <div className="flex size-5 items-center justify-center">
                      <CategoryGlyph category={cat} withTooltip />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="-mx-4 border-t border-fd-border" />

          {/* One cell per family; clicking it walks up the grade ladder. It
              wraps to new rows on narrow screens rather than scrolling. */}
          <div className="flex flex-wrap gap-3">
            {families.map((icon) => {
              const variants = familyGrades(icon);
              const cur = mountedOf(icon);
              const e = cur ?? variants[0];
              if (!e) return null;
              const isMounted = !!cur;
              return (
                <div key={icon} className="flex">
                  <DeviceBox
                    e={e}
                    isMounted={isMounted}
                    hint={!isMounted && earnsCategoryBonus(e, activeCat)}
                    activeCat={activeCat}
                    onClick={() => cycleVariants(icon, variants)}
                    onRemove={cur ? () => onToggle(cur.key) : undefined}
                    tooltipHint={cycleHint(variants, cur)}
                  />
                </div>
              );
            })}
          </div>
          {expFamilies.length > 0 ? (
            <>
              <div className="-mx-4 border-t border-fd-border" />
              {/* One cell per experimental combo; clicking it steps through its
                  three upgrade levels. */}
              <div className="flex flex-wrap gap-3">
                {expFamilies.map((icon) => {
                  const levels = expByIcon.get(icon)!;
                  const cur = mountedOf(icon);
                  const e = cur ?? levels[0];
                  const isMounted = !!cur;
                  return (
                    <div key={icon} className="flex">
                      <DeviceBox
                        e={e}
                        isMounted={isMounted}
                        hint={false}
                        activeCat={activeCat}
                        onClick={() => cycleVariants(icon, levels)}
                        onRemove={cur ? () => onToggle(cur.key) : undefined}
                        tooltipHint={cycleHint(levels, cur)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
