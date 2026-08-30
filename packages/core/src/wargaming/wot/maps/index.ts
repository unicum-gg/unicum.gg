import type { Region, WotSrcArena } from "@unicum.gg/wargaming";
import {
  BattleType,
  buildMapDetail,
  buildMapSummary,
  variantOf,
  type MapDetail,
  type MapSummary,
} from "@unicum.gg/shared";
import { getMapCatalog } from "./catalog";
import { getClanWarsArenaIds } from "./clan-wars";

export { searchMaps, type MapSearchResult } from "./search";

// The battle types the arena's own definition cannot give: Clan Wars, keyed by
// the live Global Map pool, and one per variant folded onto the map, since what
// a map is played as elsewhere is a property of that other arena rather than of
// its own definition. A map earns the Waffenträger tab by having a Waffenträger
// arena, exactly as it earns Onslaught Night by having a night one.
function extraBattleTypes(
  arenaId: string,
  clanWars: Set<string>,
  variants: WotSrcArena[],
): BattleType[] {
  const types: BattleType[] = [];
  if (clanWars.has(arenaId)) types.push(BattleType.ClanWars);
  for (const variant of variants) {
    const battleType = variantOf(variant.arenaId)?.battleType;
    if (battleType && !types.includes(battleType)) types.push(battleType);
  }
  return types;
}

/** Every battle map on a region as a lightweight gallery summary, name-sorted.
 * The catalogue is region-scoped but essentially identical across regions. */
export async function listMapSummaries(region: Region): Promise<MapSummary[]> {
  const [{ arenas, index, variantArenas, testOnlyArenas }, clanWars] =
    await Promise.all([
      getMapCatalog(region),
      getClanWarsArenaIds(region),
    ]);
  const out: MapSummary[] = [];
  for (const arena of arenas.values()) {
    const slug = index.idToSlug.get(arena.arenaId);
    if (slug) {
      const variants = variantArenas.get(arena.arenaId) ?? [];
      out.push(
        buildMapSummary(
          arena,
          slug,
          extraBattleTypes(arena.arenaId, clanWars, variants),
          variants,
          testOnlyArenas,
        ),
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
  const { arenas, index, variantArenas, testOnlyArenas } =
    await getMapCatalog(region);
  const arenaId =
    index.slugToId.get(slug.toLowerCase()) ??
    (arenas.has(slug) ? slug : undefined);
  if (arenaId === undefined) return null;
  const arena = arenas.get(arenaId);
  if (!arena) return null;
  const clanWars = await getClanWarsArenaIds(region);
  const variants = variantArenas.get(arenaId) ?? [];
  return buildMapDetail(
    arena,
    index.idToSlug.get(arenaId) ?? slug,
    extraBattleTypes(arenaId, clanWars, variants),
    variants,
    testOnlyArenas,
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
