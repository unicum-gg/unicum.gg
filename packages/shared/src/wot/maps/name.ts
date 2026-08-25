import { variantOf } from "./battle-types";

/** Turn a raw arena id into a readable fallback name ("120_graf_zeppelin" ->
 * "120 Graf Zeppelin"), used only when nothing better exists. */
function humanizeArenaId(arenaId: string): string {
  return arenaId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
