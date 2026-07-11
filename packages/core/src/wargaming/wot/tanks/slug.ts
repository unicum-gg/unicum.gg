import type { VehicleMeta } from "@unicum.gg/core/wargaming/wot/tanks/meta";

/**
 * URL slug for a tank, derived from its short name. Lowercased, accents
 * stripped, every run of non-alphanumerics collapsed to a single hyphen.
 * "IS-7" -> "is-7", "Obj. 140" -> "obj-140", "Löwe" -> "lowe", "T-34-85" ->
 * "t-34-85". Not guaranteed unique on its own; `buildTankSlugIndex` resolves
 * collisions by appending the tank id.
 */
export function slugifyTank(shortName: string): string {
  return shortName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export type TankSlugIndex = {
  slugToId: Map<string, number>;
  idToSlug: Map<number, string>;
};

/**
 * Build a bidirectional slug<->tank_id index from the vehicle catalogue.
 * A base slug that maps to a single tank keeps the clean form ("is-7"); when
 * several tanks slugify to the same base (rare, e.g. re-added/event variants)
 * every colliding tank gets the id appended ("is-7-5137") so the mapping stays
 * unique and stable. Empty slugs (a name with no alphanumerics) fall back to
 * the bare tank id.
 */
export function buildTankSlugIndex(
  encyclopedia: Record<string, VehicleMeta>,
): TankSlugIndex {
  // Group tank ids by their base slug so we can detect collisions.
  const byBase = new Map<string, number[]>();
  for (const [idStr, meta] of Object.entries(encyclopedia)) {
    const id = Number(idStr);
    const base = slugifyTank(meta.shortName) || String(id);
    const list = byBase.get(base);
    if (list) list.push(id);
    else byBase.set(base, [id]);
  }

  const slugToId = new Map<string, number>();
  const idToSlug = new Map<number, string>();
  for (const [base, ids] of byBase) {
    if (ids.length === 1) {
      const id = ids[0];
      slugToId.set(base, id);
      idToSlug.set(id, base);
      continue;
    }
    // Deterministic: sort so the layout does not depend on Object key order.
    for (const id of [...ids].sort((a, b) => a - b)) {
      const slug = `${base}-${id}`;
      slugToId.set(slug, id);
      idToSlug.set(id, slug);
    }
  }
  return { slugToId, idToSlug };
}
