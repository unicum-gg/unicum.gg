// URL slug for a map, derived from its localized display name the same way
// tanks derive theirs (see `../tanks/slug`). "Prokhorovka" -> "prokhorovka",
// "Ensk Region" -> "ensk-region", "Himmelsdorf" -> "himmelsdorf". Not guaranteed
// unique on its own; `buildMapSlugIndex` resolves the rare collision.
export function slugifyMapName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export type MapSlugIndex = {
  slugToId: Map<string, string>;
  idToSlug: Map<string, string>;
};

/**
 * Build a bidirectional slug<->arenaId index from the map catalogue. A base slug
 * that maps to a single arena keeps the clean form ("prokhorovka"); when several
 * arenas slugify to the same base (rare, only if two distinct arenas share a
 * name) each colliding arena gets its id appended so the mapping stays unique
 * and stable. An empty slug (a name with no alphanumerics) falls back to the id.
 */
export function buildMapSlugIndex(
  arenas: readonly { arenaId: string; name: string }[],
): MapSlugIndex {
  const byBase = new Map<string, string[]>();
  for (const { arenaId, name } of arenas) {
    const base = slugifyMapName(name) || arenaId;
    const list = byBase.get(base);
    if (list) list.push(arenaId);
    else byBase.set(base, [arenaId]);
  }

  const slugToId = new Map<string, string>();
  const idToSlug = new Map<string, string>();
  for (const [base, ids] of byBase) {
    if (ids.length === 1) {
      slugToId.set(base, ids[0]);
      idToSlug.set(ids[0], base);
      continue;
    }
    for (const arenaId of [...ids].sort()) {
      const slug = `${base}-${arenaId}`;
      slugToId.set(slug, arenaId);
      idToSlug.set(arenaId, slug);
    }
  }
  return { slugToId, idToSlug };
}

/**
 * Add the retired maps to an index built from the live ones, without touching a
 * single live slug.
 *
 * `buildMapSlugIndex` settles a collision by suffixing every arena involved, and
 * a retired map often shares its name with the live one that replaced it (the
 * pre-1.0 Province beside the HD one), so indexing the two together would move
 * the live map's URL. Here the live slugs are fixed and only the retired map
 * gives way, taking its arena id as a suffix whenever its clean slug is taken.
 */
export function withRetiredSlugs(
  index: MapSlugIndex,
  retired: readonly { arenaId: string; name: string }[],
): MapSlugIndex {
  const slugToId = new Map(index.slugToId);
  const idToSlug = new Map(index.idToSlug);
  for (const { arenaId, name } of retired) {
    const base = slugifyMapName(name) || arenaId;
    const slug = slugToId.has(base) ? `${base}-${arenaId.toLowerCase()}` : base;
    slugToId.set(slug, arenaId);
    idToSlug.set(arenaId, slug);
  }
  return { slugToId, idToSlug };
}
