import { variantOf } from "./battle-types";

/** Turn a raw arena id into a readable fallback name ("120_graf_zeppelin" ->
 * "120 Graf Zeppelin"), used only when nothing better exists. */
function humanizeArenaId(arenaId: string): string {
  return arenaId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A map's display name, and where it came from. */
export type ResolvedMapName = {
  name: string;
  /**
   * Whether the name comes from the client's own strings (its `arenas.po` entry,
   * or its base map's for a variant), as opposed to being humanized off the raw
   * arena id.
   *
   * Load-bearing, not informational. The mirror publishes a client update in two
   * builds days apart, the arena definitions first and the strings after, so an
   * arena really does exist for days with no name to read. The humanized id is a
   * fine placeholder for a page, and a trap for anything that keys on the name:
   * it is not the map's name, it changes the day the real one lands, and the map
   * history tells a rework from a different map by comparing names.
   */
  resolved: boolean;
};

/**
 * The display name for a map. For an event/mode variant (`variantOf`) it is the
 * base map's name with the variant tag appended ("Steppes (Waffenträger)");
 * `baseName` resolves the base id, supplied by the catalogue, which holds every
 * arena. Otherwise the localized `.po` name, else a humanized id.
 *
 * A variant is named exactly as well as its base is: it carries no name of its
 * own to fall back on, so an unnamed base makes an unnamed variant, whatever the
 * two ids look like.
 */
export function resolveMapName(
  arenaId: string,
  poName: string | undefined,
  baseName: (baseId: string) => ResolvedMapName,
): ResolvedMapName {
  const variant = variantOf(arenaId);
  if (variant) {
    const base = baseName(variant.baseId);
    return { name: `${base.name} (${variant.tag})`, resolved: base.resolved };
  }
  // `poName === arenaId` is the SDK's own "no entry" fallback, not a name.
  const named = poName !== undefined && poName !== "" && poName !== arenaId;
  return { name: named ? poName : humanizeArenaId(arenaId), resolved: named };
}
