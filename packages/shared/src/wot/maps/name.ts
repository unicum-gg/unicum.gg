import { variantOf } from "./battle-types";

// A handful of client arenas have neither an `arenas.po` name nor a base map to
// borrow one from; give them a readable label instead of the raw id.
const SPECIAL_NAMES: Record<string, string> = {
  hangar_v4: "Garage",
};

/** Turn a raw arena id into a readable fallback name ("h33_battle_royale_2021"
 * -> "H33 Battle Royale 2021"), used only when nothing better exists. */
function humanizeArenaId(arenaId: string): string {
  return (
    SPECIAL_NAMES[arenaId] ??
    arenaId
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** The display name for a map. For an event/mode variant (`variantOf`) it is the
 * base map's name with the variant tag appended ("Steppes (Waffenträger)");
 * `baseName` resolves the base id (supplied by the catalogue, which holds every
 * arena). Otherwise the localized `.po` name, else a humanized id. */
export function mapDisplayName(
  arenaId: string,
  poName: string | undefined,
  baseName: (baseId: string) => string | undefined,
): string {
  const variant = variantOf(arenaId);
  if (variant) {
    const base =
      baseName(variant.baseId) ?? poName ?? humanizeArenaId(variant.baseId);
    return `${base} (${variant.tag})`;
  }
  return poName && poName !== arenaId ? poName : humanizeArenaId(arenaId);
}
