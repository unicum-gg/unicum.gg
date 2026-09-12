import type { Region, WotSrcArena } from "@unicum.gg/wargaming";
import {
  BattleType,
  buildMapDetail,
  buildMapSummary,
  gameModeFromRaw,
  variantOf,
  type MapDetail,
  type MapGameMode,
  type MapMarker,
  type MapPoi,
  type MapSummary,
} from "@unicum.gg/shared";
import { getMapCatalog, type MapCatalog } from "./catalog";
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

/** A URL slug or a bare arena id, resolved against the catalogue to the arena
 * it addresses. Undefined for an id the catalogue does not carry. */
function arenaIdOf(catalog: MapCatalog, slug: string): string | undefined {
  return (
    catalog.index.slugToId.get(slug.toLowerCase()) ??
    (catalog.arenas.has(slug) ? slug : undefined)
  );
}

/** Resolve a URL slug (or a bare arena id) to its full map detail, or null. The
 * returned `slug` is always the canonical one, so the page can redirect a legacy
 * id form onto it. */
export async function getMapDetailBySlug(
  region: Region,
  slug: string,
): Promise<MapDetail | null> {
  const catalog = await getMapCatalog(region);
  const { arenas, index, variantArenas, testOnlyArenas } = catalog;
  const arenaId = arenaIdOf(catalog, slug);
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

/** The map a declared battle names: enough to check the battle against the
 * catalogue, to say which map it was, and to link the page it belongs on. */
export type BattleMap = {
  arenaId: string;
  /** Canonical, so a submission filed under a legacy id form still lands on the
   * page that exists today. */
  slug: string;
  name: string;
  /** The random-battle modes the arena declares, which is what decides whether
   * a battle can be filed under the mode it claims. */
  modes: MapGameMode[];
};

/**
 * Resolve the map a submitted battle names, and only what validates it.
 *
 * `getMapDetailBySlug` answers this too, and is what the submission path used
 * to ask, but a detail also carries the battle types the arena's own definition
 * cannot give, which means the live Global Map pool, which means a `fronts`
 * call followed by up to twenty pages of provinces. That walk is fail-open for
 * a gallery, where a throttled WG costs a map its Clan Wars tab. On the way in
 * it costs somebody watching a "Sending..." button every retry the transport
 * has in it, for a pool that decides which tabs a map page draws and says
 * nothing whatsoever about whether a battle may be filed.
 *
 * Narrow on purpose rather than a `MapDetail` with a hole in it: the battle
 * types this leaves out would otherwise be quietly wrong for the next caller.
 */
export async function resolveBattleMap(
  region: Region,
  slug: string,
): Promise<BattleMap | null> {
  const catalog = await getMapCatalog(region);
  const arenaId = arenaIdOf(catalog, slug);
  if (arenaId === undefined) return null;
  const arena = catalog.arenas.get(arenaId);
  if (!arena) return null;
  // Built through the same builder the pages use, so the modes are folded the
  // way they are folded everywhere else (`assault` and `assault2` are one
  // Assault), with the extra battle types left at their default.
  const detail = buildMapDetail(
    arena,
    catalog.index.idToSlug.get(arenaId) ?? slug,
    [],
    catalog.variantArenas.get(arenaId) ?? [],
    catalog.testOnlyArenas,
  );
  return {
    arenaId,
    slug: detail.slug,
    name: detail.name,
    modes: detail.modes,
  };
}

/** Every map's arena id and canonical slug. Backs generateStaticParams and the
 * sitemap. */
export async function listMapSlugs(
  region: Region,
): Promise<{ arenaId: string; slug: string }[]> {
  const { index } = await getMapCatalog(region);
  return [...index.idToSlug].map(([arenaId, slug]) => ({ arenaId, slug }));
}

/** One map as another page refers to it: enough to name it, link it, and draw
 * the spawns a match was played from. */
export type MapRef = {
  arenaId: string;
  slug: string;
  name: string;
  minimapUrl: string;
  /**
   * Where each side starts, projected onto the minimap, for the battle type
   * asked for. Empty when the map does not carry that mode, which is a real
   * answer: an organiser's pool can name a map the mode was never played on.
   *
   * `team1`/`team2` are the arena's own two sides, which is exactly what a
   * tournament's team 1 and team 2 are assigned to.
   */
  spawns: { team1: MapMarker[]; team2: MapMarker[] };
  bases: { team1: MapMarker[]; team2: MapMarker[] };
  /** The single point both sides fight over, on the modes that have one. */
  controlPoint: MapMarker | null;
  /** Onslaught's posts (Artillery Headquarters, Comms Center, Observation
   * Post). Empty on every random-battle mode, which has none. */
  pointsOfInterest: MapPoi[];
  /** The play area in metres, which is what a point's capture radius is drawn
   * against. */
  widthMeters: number;
  heightMeters: number;
};

const EMPTY_SIDES = { team1: [] as MapMarker[], team2: [] as MapMarker[] };

/**
 * The spawn geometry for one battle type, or empty when the map has none of it.
 *
 * Onslaught is not one of the random-battle modes and carries its own reduced
 * layout, so it is read from `onslaught` rather than from `geometry`; it has
 * spawns but no per-side bases (both sides fight over one control point).
 */
function sidesFor(detail: MapDetail, mode: MapGameMode | null, raw: string) {
  if (raw === "comp7") {
    const onslaught = detail.onslaught;
    return {
      minimapUrl: onslaught?.minimapUrl ?? detail.minimapUrl,
      spawns: onslaught?.spawns ?? EMPTY_SIDES,
      bases: EMPTY_SIDES,
      // Onslaught's whole layout: one contested control point and the posts
      // around it. Without them a tournament minimap shows two spawns on an
      // empty field, which is the mode's least interesting half.
      controlPoint: onslaught?.controlPoint ?? null,
      pointsOfInterest: onslaught?.pointsOfInterest ?? [],
      widthMeters: onslaught?.widthMeters ?? detail.widthMeters,
      heightMeters: onslaught?.heightMeters ?? detail.heightMeters,
    };
  }
  const geometry = mode ? detail.geometry.find((g) => g.mode === mode) : undefined;
  return {
    minimapUrl: detail.minimapUrl,
    spawns: geometry?.spawns ?? EMPTY_SIDES,
    bases: geometry?.bases ?? EMPTY_SIDES,
    controlPoint: geometry?.controlPoint ?? null,
    pointsOfInterest: [],
    widthMeters: detail.widthMeters,
    heightMeters: detail.heightMeters,
  };
}

/**
 * Resolve arena ids to the maps they address, for a page that holds ids rather
 * than maps (a tournament's map pool is a list of arena ids).
 *
 * `battleType` is the raw gameplay token the other system speaks (`ctf`,
 * `domination`, `assault2`, `comp7`), and it decides which spawns come back:
 * a map's two sides sit somewhere different in Encounter than in Assault, so
 * asking for the geometry without saying the mode would draw the wrong corners.
 *
 * An id the catalogue does not know is simply absent from the result, so a
 * caller renders it as the text it is rather than as a link to nothing.
 */
export async function resolveArenaRefs(
  region: Region,
  arenaIds: readonly string[],
  battleType?: string,
): Promise<Map<string, MapRef>> {
  if (arenaIds.length === 0) return new Map();
  const { index } = await getMapCatalog(region);
  const mode = battleType ? gameModeFromRaw(battleType) : null;
  const out = new Map<string, MapRef>();
  for (const arenaId of new Set(arenaIds)) {
    const slug = index.idToSlug.get(arenaId);
    if (!slug) continue;
    const detail = await getMapDetailBySlug(region, slug);
    if (!detail) continue;
    out.set(arenaId, {
      arenaId,
      slug: detail.slug,
      name: detail.name,
      ...sidesFor(detail, mode, battleType ?? ""),
    });
  }
  return out;
}
