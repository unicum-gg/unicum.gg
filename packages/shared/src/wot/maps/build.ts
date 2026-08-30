import type { ArenaGameplay, ArenaPoint, WotSrcArena } from "@unicum.gg/wargaming";
import { BattleType, battleTypesForArena } from "./battle-types";
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
  night: MapSummary["night"],
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
    night,
  };
}

// A map has at most one night arena, so the list the catalogue hands over is
// read as "the night version, if there is one". Its minimap comes from the built
// layout rather than from the id, so the gallery card and the page's night view
// can never resolve to different images.
function nightOf(onslaughtArenas: WotSrcArena[]): MapSummary["night"] {
  const arena = onslaughtArenas[0];
  const layout = arena ? buildOnslaught(arena) : null;
  return layout && arena
    ? { arenaId: arena.arenaId, minimapUrl: layout.minimapUrl }
    : null;
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
  onslaughtArenas: WotSrcArena[] = [],
): MapSummary {
  const battleTypes = allBattleTypes(arena, extraBattleTypes);
  return summaryOf(
    arena,
    slug,
    battleTypes,
    runsRandomEvents(arena, battleTypes),
    nightOf(onslaughtArenas),
  );
}

/**
 * `onslaughtArenas` are the night Onslaught arenas the client ships beside this
 * map (`variantOf(...).foldedIntoBase`). They are the same map after dark, so
 * their layout belongs on its page rather than on a card of their own, and they
 * are appended after the map's own Onslaught mode.
 */
export function buildMapDetail(
  arena: WotSrcArena,
  slug: string,
  extraBattleTypes: BattleType[] = [],
  onslaughtArenas: WotSrcArena[] = [],
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
      nightOf(onslaughtArenas),
    ),
    description: arena.description,
    roundLength: arena.roundLength,
    maxPlayersInTeam: arena.maxPlayersInTeam,
    widthMeters: width,
    heightMeters: height,
    geometry: buildGeometry(arena),
    onslaught: [arena, ...onslaughtArenas]
      .map(buildOnslaught)
      .filter((o) => o !== null),
    randomEvents,
  };
}
