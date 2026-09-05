import type { ArenaGameplay, ArenaPoint, WotSrcArena } from "@unicum.gg/wargaming";
import { BattleType, battleTypesForArena, variantOf } from "./battle-types";
import { mapCamouflage } from "./camouflage";
import { gameModeFromRaw, MAP_GAME_MODE_LABEL, MapGameMode } from "./game-modes";
import { projectPoint, type MapPoint } from "./geometry";
import { minimapUrl, onslaughtMinimapUrl } from "./minimap";
import { buildRandomEvents, hasRandomEventLayers } from "./random-events";
import type {
  MapDetail,
  MapModeGeometry,
  MapOnslaught,
  MapSummary,
  MapVariantLayout,
  MapVariantSummary,
} from "./map";

type BoundingBox = { bottomLeft: MapPoint; upperRight: MapPoint };

function projectIn(points: ArenaPoint[], bb: BoundingBox) {
  return points.map((p) => projectPoint(p, bb));
}

function project(points: ArenaPoint[], arena: WotSrcArena) {
  return arena.boundingBox ? projectIn(points, arena.boundingBox) : [];
}

// Build one Onslaught (comp7) layout: its own reduced play area, minimap and
// geometry (central control point + per-team spawns). Uses the comp7 minimap
// only when the mode references one, else falls back to the standard minimap.
// The arena is either the map itself or a night Onslaught arena of it, which is
// why every url here is keyed by `arena.arenaId` rather than the map's.
function buildOnslaught(arena: WotSrcArena): MapOnslaught | null {
  const comp7 = arena.gameplay.find((g) => g.mode === "comp7");
  if (!comp7) return null;
  const bb = comp7.boundingBox ?? arena.boundingBox;
  if (!bb) return null;
  const usesVariant = (comp7.minimap ?? "").includes("comp7");
  return {
    arenaId: arena.arenaId,
    minimapUrl: usesVariant
      ? onslaughtMinimapUrl(arena.arenaId)
      : minimapUrl(arena.arenaId),
    widthMeters: Math.round(bb.upperRight.x - bb.bottomLeft.x),
    heightMeters: Math.round(bb.upperRight.z - bb.bottomLeft.z),
    spawns: {
      team1: projectIn(comp7.spawns.team1, bb),
      team2: projectIn(comp7.spawns.team2, bb),
    },
    controlPoint: comp7.controlPoint
      ? projectPoint(comp7.controlPoint, bb)
      : null,
    pointsOfInterest: comp7.pointsOfInterest.map((poi) => ({
      marker: projectPoint(poi.position, bb),
      type: poi.type,
    })),
  };
}

// Fold the raw gameplay types into surfaced modes: drop unknown tokens, and when
// several raw tokens map to the same mode (`assault` + `assault2` -> Assault)
// keep the first with any geometry so the overlay still has base/spawn points.
function buildGeometry(arena: WotSrcArena): MapModeGeometry[] {
  const byMode = new Map<MapGameMode, MapModeGeometry>();
  for (const g of arena.gameplay) {
    const mode = gameModeFromRaw(g.mode);
    if (mode === null || byMode.has(mode)) continue;
    byMode.set(mode, {
      mode,
      label: MAP_GAME_MODE_LABEL[mode],
      bases: {
        team1: project(g.bases.team1, arena),
        team2: project(g.bases.team2, arena),
      },
      spawns: {
        team1: project(g.spawns.team1, arena),
        team2: project(g.spawns.team2, arena),
      },
      controlPoint:
        g.controlPoint && arena.boundingBox
          ? projectPoint(g.controlPoint, arena.boundingBox)
          : null,
    });
  }
  return [...byMode.values()];
}

// Base positions for the gallery thumbnail: prefer the Standard mode (the
// classic two-base layout), else the first mode that defines any base.
function primaryBases(arena: WotSrcArena) {
  const geo = buildGeometry(arena);
  const hasBase = (g: MapModeGeometry) =>
    g.bases.team1.length > 0 || g.bases.team2.length > 0;
  const chosen =
    geo.find((g) => g.mode === MapGameMode.Standard && hasBase(g)) ??
    geo.find(hasBase);
  return chosen ? chosen.bases : { team1: [], team2: [] };
}

function distinctModes(gameplay: ArenaGameplay[]): MapGameMode[] {
  const seen = new Set<MapGameMode>();
  for (const g of gameplay) {
    const mode = gameModeFromRaw(g.mode);
    if (mode !== null) seen.add(mode);
  }
  return [...seen];
}

function dimensions(arena: WotSrcArena) {
  const bb = arena.boundingBox;
  if (!bb) return { width: 0, height: 0, size: 0 };
  const width = Math.round(bb.upperRight.x - bb.bottomLeft.x);
  const height = Math.round(bb.upperRight.z - bb.bottomLeft.z);
  return { width, height, size: Math.max(width, height) };
}

function allBattleTypes(
  arena: WotSrcArena,
  extraBattleTypes: BattleType[],
): BattleType[] {
  return [
    ...battleTypesForArena(
      arena.arenaId,
      arena.gameplay.map((g) => g.mode),
      arena.maxPlayersInTeam,
    ),
    ...extraBattleTypes,
  ];
}

// Random events are a Random Battle feature, so they are only read off a map
// that is played there. The scripted demolitions a Story Mode chapter ships as
// the same kind of minimap layer are part of its scenario, not an event that may
// or may not fire, and calling them one would misread the map.
function runsRandomEvents(
  arena: WotSrcArena,
  battleTypes: BattleType[],
): boolean {
  return (
    battleTypes.includes(BattleType.Random) &&
    hasRandomEventLayers(arena.minimapLayers)
  );
}

// The summary, once its battle types and event flag are known. Both are derived
// twice otherwise, since the detail needs the battle types for its own events
// and then spreads the summary on top.
function summaryOf(
  arena: WotSrcArena,
  slug: string,
  battleTypes: BattleType[],
  hasRandomEvents: boolean,
  variants: MapVariantSummary[],
  commonTest: boolean,
): MapSummary {
  const { size } = dimensions(arena);
  return {
    arenaId: arena.arenaId,
    slug,
    name: arena.name,
    camouflage: mapCamouflage(arena.camouflage),
    sizeMeters: size,
    modes: distinctModes(arena.gameplay),
    battleTypes,
    minimapUrl: minimapUrl(arena.arenaId),
    bases: primaryBases(arena),
    hasRandomEvents,
    commonTest,
    variants,
  };
}

// A variant is a whole arena, so its minimap is the one its own layout resolved:
// its Onslaught image when that is what it is played on (the night versions),
// its standard one otherwise. Reading it here rather than deriving it from the
// id is what keeps the gallery card and the page's view on the same image.
function variantSummary(
  arena: WotSrcArena,
  testOnly: ReadonlySet<string>,
): MapVariantSummary | null {
  const battleType = variantOf(arena.arenaId)?.battleType;
  if (!battleType) return null;
  const onslaught = buildOnslaught(arena);
  return {
    arenaId: arena.arenaId,
    battleType,
    minimapUrl: onslaught?.minimapUrl ?? minimapUrl(arena.arenaId),
    commonTest: testOnly.has(arena.arenaId),
  };
}

function variantSummaries(
  arenas: WotSrcArena[],
  testOnly: ReadonlySet<string>,
): MapVariantSummary[] {
  return arenas
    .map((a) => variantSummary(a, testOnly))
    .filter((v) => v !== null);
}

function variantLayouts(
  arenas: WotSrcArena[],
  testOnly: ReadonlySet<string>,
): MapVariantLayout[] {
  return arenas.flatMap((arena) => {
    const summary = variantSummary(arena, testOnly);
    if (!summary) return [];
    const { width, height } = dimensions(arena);
    return [
      {
        ...summary,
        widthMeters: width,
        heightMeters: height,
        geometry: buildGeometry(arena),
        onslaught: buildOnslaught(arena),
      },
    ];
  });
}

// The map's display name (with any variant disambiguation, e.g. "Steppes
// (Waffenträger)") is resolved by the catalogue layer onto `arena.name` before
// building. `extraBattleTypes` carries the dynamic types the static scripts
// can't express (Clan Wars, from the live Global Map season), appended to the
// derived ones. The low-res minimap fallback for maps with no HD asset is
// handled at render time by the minimap component.
export function buildMapSummary(
  arena: WotSrcArena,
  slug: string,
  extraBattleTypes: BattleType[] = [],
  variantArenas: WotSrcArena[] = [],
  testOnlyArenas: ReadonlySet<string> = new Set(),
): MapSummary {
  const battleTypes = allBattleTypes(arena, extraBattleTypes);
  return summaryOf(
    arena,
    slug,
    battleTypes,
    runsRandomEvents(arena, battleTypes),
    variantSummaries(variantArenas, testOnlyArenas),
    testOnlyArenas.has(arena.arenaId),
  );
}

/**
 * `variantArenas` are the arenas the client ships under this map's name for a
 * mode of their own (`variantOf(...).foldedIntoBase`): the Waffenträger and Last
 * Stand reskins, the Story Mode chapters, the Onslaught night versions. They are
 * this map played elsewhere, so each becomes a view of its page rather than a
 * card of its own.
 */
export function buildMapDetail(
  arena: WotSrcArena,
  slug: string,
  extraBattleTypes: BattleType[] = [],
  variantArenas: WotSrcArena[] = [],
  testOnlyArenas: ReadonlySet<string> = new Set(),
): MapDetail {
  const { width, height } = dimensions(arena);
  const battleTypes = allBattleTypes(arena, extraBattleTypes);
  const randomEvents = runsRandomEvents(arena, battleTypes)
    ? buildRandomEvents(arena.arenaId, arena.minimapLayers)
    : [];
  return {
    ...summaryOf(
      arena,
      slug,
      battleTypes,
      randomEvents.length > 0,
      variantSummaries(variantArenas, testOnlyArenas),
      testOnlyArenas.has(arena.arenaId),
    ),
    description: arena.description,
    roundLength: arena.roundLength,
    maxPlayersInTeam: arena.maxPlayersInTeam,
    widthMeters: width,
    heightMeters: height,
    geometry: buildGeometry(arena),
    onslaught: buildOnslaught(arena),
    variants: variantLayouts(variantArenas, testOnlyArenas),
    randomEvents,
  };
}
