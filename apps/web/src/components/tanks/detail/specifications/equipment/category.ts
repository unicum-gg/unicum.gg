import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import { iconUrl } from "@unicum.gg/shared";

export type Equipment = TankLoadout["equipment"][number];
export type Slot = TankLoadout["slots"][number];

// Equipment 2.0 categories: only the site's accent tint per category is our own
// (the game paints every specialization the same orange). The label matches the
// game's own (`tank_params/relative*`) and the glyph is derived from the key, so
// neither is duplicated here.
export const CATEGORY: Record<string, { label: string; color: string }> = {
  firepower: { label: "Firepower", color: "#e0524c" },
  mobility: { label: "Mobility", color: "#7db61c" },
  survivability: { label: "Survivability", color: "#4a9fe0" },
  stealth: { label: "Concealment", color: "#e0b23a" },
};

// The game's own specialization glyph for a category (wot.assets mirror), keyed
// by the wot-src category name — derived, not listed per category.
export function categoryIcon(category: string): string {
  return iconUrl(`specialization/${category}_on.png`);
}

export function categoryColor(cat: string | null): string | null {
  return cat ? (CATEGORY[cat]?.color ?? null) : null;
}

// The game's own grade/level overlays, composited over the icon (WG's public API
// returns the plain artefact image, same as the standard device, so the marker
// is this in-game overlay). Served straight from our wot.assets mirror (WG
// branch) rather than committed into the repo, like every other game asset.
const GRADE_OVERLAY: Record<string, string> = {
  bond: iconUrl("artefact/equipmentPlus_overlay.png"),
  bounty: iconUrl("artefact/equipmentTrophyBasic_overlay.png"),
  bountyUpgraded: iconUrl("artefact/equipmentTrophyUpgraded_overlay.png"),
};

/** The experimental level (1-3) of a modernized device, from its key suffix. */
export function experimentalLevel(e: Equipment): number {
  return e.grade === "experimental" ? Number(e.key.match(/(\d+)$/)?.[1] ?? 0) : 0;
}

/** The corner overlay for a device: the grade badge, or the experimental level
 * chevrons (1/2/3). Standard gear has none. */
export function overlayFor(e: Equipment): string | null {
  const level = experimentalLevel(e);
  if (level > 0) {
    return iconUrl(`demountKit/experimental_level_icon_lvl${level}.png`);
  }
  return GRADE_OVERLAY[e.grade] ?? null;
}

export const GRADE_LABEL: Record<string, string> = {
  bond: "Bond equipment",
  bounty: "Bounty equipment",
  bountyUpgraded: "Improved Bounty equipment",
  experimental: "Experimental equipment",
};

/** A category's coloured glyph. With `withTooltip`, hovering names the category
 * (so the UI never spells the category out inline). */

/** The chosen category of a slot: the role slot follows its picked option. */
export function slotCategory(slot: Slot, roleCat: string | null): string | null {
  return slot.role ? roleCat : slot.category;
}

/** True when the equipment's category matches this slot (i.e. it fits the
 * slot's specialization). Used to hint compatible devices and to prefer a
 * matching slot when mounting. */
export function hasCategoryBonus(
  equip: Pick<Equipment, "categories">,
  category: string | null,
): boolean {
  return category !== null && equip.categories.includes(category);
}

/** True when a matching slot actually boosts the equipment. Only the standard
 * set carries a distinct specialization value (its `valueByLevel` has a second,
 * better number); bond, bounty and experimental gear ship a flat value
 * (base === bonus), so the game gives them no specialization bonus. */
export function earnsCategoryBonus(
  equip: Pick<Equipment, "categories" | "effects">,
  category: string | null,
): boolean {
  return (
    hasCategoryBonus(equip, category) &&
    equip.effects.some((e) => e.base !== e.bonus)
  );
}

/** The note shown in a cell's tooltip about what clicking it again does, when
 * the family has several variants (grades or experimental levels) to step
 * through. Returns nothing for single-variant families. */
export function cycleHint(variants: Equipment[], cur: Equipment | null): string | undefined {
  if (variants.length <= 1) return undefined;
  const idx = cur ? variants.findIndex((v) => v.key === cur.key) : -1;
  if (idx < 0) return "Click to mount, then again to step up the variant.";
  if (idx < variants.length - 1)
    return `Click to switch to ${variants[idx + 1].name}.`;
  return "Click again to remove.";
}
