import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { buildTankSlugIndex, type TankSlugIndex, type VehicleMeta } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";

// Some wot-src entries have no display name (retired IGR premiums, training-room
// bot placeholders), so the parser falls back to the raw i18n key
// (`GB08_Churchill_I_IGR`, `botVehicleType/heavyTank`). A real tank name never
// contains an underscore or "VehicleType", so we hide these from every
// catalogue surface. Central helper so there is one place to extend.
function isDisplayableTank(name: string): boolean {
  return !name.includes("_") && !name.includes("VehicleType");
}

// The slug index is derived from the (cached) encyclopedia, so it changes only
// when the weekly vehicles cron runs. Memoized per region with the same 7-day
// TTL; a miss just rebuilds from the in-memory encyclopedia (<1ms for ~1200
// tanks), so this is pure convenience over correctness.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const indexCache = new Map<Region, { index: TankSlugIndex; expiresAt: number }>();

async function getSlugIndex(region: Region): Promise<TankSlugIndex> {
  const cached = indexCache.get(region);
  if (cached && cached.expiresAt > Date.now()) return cached.index;
  const encyclopedia = await getVehicleEncyclopedia(region);
  const index = buildTankSlugIndex(encyclopedia);
  indexCache.set(region, { index, expiresAt: Date.now() + CACHE_TTL_MS });
  return index;
}

export type TankIdentity = {
  tankId: number;
  slug: string;
  meta: VehicleMeta;
};

/** Resolve a URL slug to its tank, or null if no tank maps to it. */
export async function getTankBySlug(
  region: Region,
  slug: string,
): Promise<TankIdentity | null> {
  const [index, encyclopedia] = await Promise.all([
    getSlugIndex(region),
    getVehicleEncyclopedia(region),
  ]);
  // Resolve by slug; fall back to a bare tank id so legacy numeric URLs (from
  // before tanks had readable slugs) still render. The returned `slug` is always
  // the canonical one, so the page's canonical/OG point at the pretty form.
  const tankId =
    index.slugToId.get(slug.toLowerCase()) ??
    (/^\d+$/.test(slug) && encyclopedia[slug] ? Number(slug) : undefined);
  if (tankId === undefined) return null;
  const meta = encyclopedia[String(tankId)];
  if (!meta) return null;
  return { tankId, slug: index.idToSlug.get(tankId) ?? slug, meta };
}

/** The canonical slug for a tank id (null if the tank is not in the catalogue). */
export async function getTankSlug(
  region: Region,
  tankId: number,
): Promise<string | null> {
  const index = await getSlugIndex(region);
  return index.idToSlug.get(tankId) ?? null;
}

export type TankSearchResult = {
  tank_id: number;
  slug: string;
  name: string;
  short_name: string;
  tag: string;
  tier: number;
  nation: string;
  type: string;
  is_premium: boolean;
};

/**
 * Prefix/substring search over the vehicle catalogue. Runs entirely in memory
 * against the cached encyclopedia (~1200 tanks), so it's instant and never
 * touches the DB. Ranks exact name matches first, then prefix, then substring;
 * ties break by tier (high first) so the tanks people actually search surface.
 */
export async function searchTanks(
  region: Region,
  query: string,
  limit = 5,
): Promise<TankSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  // Alphanumeric-only form so "e100" matches "E 100", "is7" matches "IS-7",
  // "obj140" matches "Obj. 140", the way people actually type tank names.
  const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const qa = alnum(q);
  const [index, encyclopedia] = await Promise.all([
    getSlugIndex(region),
    getVehicleEncyclopedia(region),
  ]);

  type Scored = { entry: TankSearchResult; score: number };
  const scored: Scored[] = [];
  for (const [idStr, meta] of Object.entries(encyclopedia)) {
    if (!isDisplayableTank(meta.name)) continue; // untranslated internal variant
    const name = meta.name.toLowerCase();
    const shortName = meta.shortName.toLowerCase();
    const tag = meta.tag.toLowerCase();
    const nameA = alnum(name);
    const shortA = alnum(shortName);
    let score = 0;
    if (name === q || shortName === q || nameA === qa || shortA === qa) score = 4;
    else if (
      shortName.startsWith(q) ||
      name.startsWith(q) ||
      shortA.startsWith(qa) ||
      nameA.startsWith(qa)
    )
      score = 3;
    else if (tag.startsWith(q) || alnum(tag).startsWith(qa)) score = 2;
    else if (
      shortName.includes(q) ||
      name.includes(q) ||
      (qa.length > 0 && (shortA.includes(qa) || nameA.includes(qa)))
    )
      score = 1;
    if (score === 0) continue;
    const tankId = Number(idStr);
    scored.push({
      score,
      entry: {
        tank_id: tankId,
        slug: index.idToSlug.get(tankId) ?? String(tankId),
        name: meta.name,
        short_name: meta.shortName,
        tag: meta.tag,
        tier: meta.tier,
        nation: meta.nation,
        type: meta.type,
        is_premium: meta.isPremium,
      },
    });
  }
  scored.sort((a, b) => b.score - a.score || b.entry.tier - a.entry.tier);
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * The same rows, addressed by tank id instead of by name. Backs the search
 * dialog's saved entries, which keep the id and ask for the current row rather
 * than storing a copy of it.
 *
 * Unknown ids are dropped: a vehicle can leave the catalogue, and the caller has
 * its own copy for that case.
 */
export async function getTanksByIds(
  region: Region,
  tankIds: number[],
): Promise<TankSearchResult[]> {
  if (tankIds.length === 0) return [];
  const [index, encyclopedia] = await Promise.all([
    getSlugIndex(region),
    getVehicleEncyclopedia(region),
  ]);
  const out: TankSearchResult[] = [];
  for (const tankId of new Set(tankIds)) {
    const meta = encyclopedia[String(tankId)];
    if (!meta) continue;
    out.push({
      tank_id: tankId,
      slug: index.idToSlug.get(tankId) ?? String(tankId),
      name: meta.name,
      short_name: meta.shortName,
      tag: meta.tag,
      tier: meta.tier,
      nation: meta.nation,
      type: meta.type,
      is_premium: meta.isPremium,
    });
  }
  return out;
}

/**
 * Every tank in the catalogue with its slug and metadata. Backs
 * generateStaticParams and the sitemap. The catalogue is region-scoped but
 * essentially identical across regions (~1200 tanks incl. removed/event ones).
 */
export async function listTanks(region: Region): Promise<TankIdentity[]> {
  const [index, encyclopedia] = await Promise.all([
    getSlugIndex(region),
    getVehicleEncyclopedia(region),
  ]);
  const out: TankIdentity[] = [];
  for (const [tankId, slug] of index.idToSlug) {
    const meta = encyclopedia[String(tankId)];
    if (meta && isDisplayableTank(meta.name)) out.push({ tankId, slug, meta });
  }
  return out;
}
