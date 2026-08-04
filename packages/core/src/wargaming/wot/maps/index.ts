import type { Region } from "@unicum.gg/wargaming";
import {
  BattleType,
  buildMapDetail,
  buildMapSummary,
  type MapDetail,
  type MapSummary,
} from "@unicum.gg/shared";
import { getMapCatalog } from "./catalog";
import { getClanWarsArenaIds } from "./clan-wars";

export { searchMaps, type MapSearchResult } from "./search";

// The dynamic (non-static-script) battle types a given arena belongs to. Today
// that is only Clan Wars, keyed by the live Global Map pool.
function extraBattleTypes(arenaId: string, clanWars: Set<string>): BattleType[] {
  return clanWars.has(arenaId) ? [BattleType.ClanWars] : [];
}

/** Every battle map on a region as a lightweight gallery summary, name-sorted.
 * The catalogue is region-scoped but essentially identical across regions. */
export async function listMapSummaries(region: Region): Promise<MapSummary[]> {
  const [{ arenas, index }, clanWars] = await Promise.all([
    getMapCatalog(region),
    getClanWarsArenaIds(region),
  ]);
  const out: MapSummary[] = [];
  for (const arena of arenas.values()) {
    const slug = index.idToSlug.get(arena.arenaId);
    if (slug) {
      out.push(
        buildMapSummary(arena, slug, extraBattleTypes(arena.arenaId, clanWars)),
      );
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a URL slug (or a bare arena id) to its full map detail, or null. The
 * returned `slug` is always the canonical one, so the page can redirect a legacy
 * id form onto it. */
export async function getMapDetailBySlug(
  region: Region,
  slug: string,
): Promise<MapDetail | null> {
  const { arenas, index } = await getMapCatalog(region);
  const arenaId =
    index.slugToId.get(slug.toLowerCase()) ??
    (arenas.has(slug) ? slug : undefined);
  if (arenaId === undefined) return null;
  const arena = arenas.get(arenaId);
  if (!arena) return null;
  const clanWars = await getClanWarsArenaIds(region);
  return buildMapDetail(
    arena,
    index.idToSlug.get(arenaId) ?? slug,
    extraBattleTypes(arenaId, clanWars),
  );
}

/** Every map's arena id and canonical slug. Backs generateStaticParams and the
 * sitemap. */
export async function listMapSlugs(
  region: Region,
): Promise<{ arenaId: string; slug: string }[]> {
  const { index } = await getMapCatalog(region);
  return [...index.idToSlug].map(([arenaId, slug]) => ({ arenaId, slug }));
}
