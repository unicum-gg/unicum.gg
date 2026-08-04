import type { ArenaGameplay, ArenaPoint, WotSrcArena } from "@unicum.gg/wargaming";
import { BattleType, battleTypesForArena } from "./battle-types";
import { mapCamouflage } from "./camouflage";
import { gameModeFromRaw, MAP_GAME_MODE_LABEL, MapGameMode } from "./game-modes";
import { projectPoint, type MapPoint } from "./geometry";
import { minimapUrl, onslaughtMinimapUrl } from "./minimap";
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

// Build the Onslaught (comp7) variant: its own reduced play area, minimap and
// geometry (central control point + per-team spawns). Uses the comp7 minimap
// only when the mode references one, else falls back to the standard minimap.
function buildOnslaught(arena: WotSrcArena): MapOnslaught | null {
  const comp7 = arena.gameplay.find((g) => g.mode === "comp7");
  if (!comp7) return null;
  const bb = comp7.boundingBox ?? arena.boundingBox;
  if (!bb) return null;
  const usesVariant = (comp7.minimap ?? "").includes("comp7");
  return {
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
): MapSummary {
  const { size } = dimensions(arena);
  const modes = distinctModes(arena.gameplay);
  return {
    arenaId: arena.arenaId,
    slug,
    name: arena.name,
    camouflage: mapCamouflage(arena.camouflage),
    sizeMeters: size,
    modes,
    battleTypes: [
      ...battleTypesForArena(
        arena.arenaId,
        arena.gameplay.map((g) => g.mode),
        arena.maxPlayersInTeam,
      ),
      ...extraBattleTypes,
    ],
    minimapUrl: minimapUrl(arena.arenaId),
    bases: primaryBases(arena),
  };
}

export function buildMapDetail(
  arena: WotSrcArena,
  slug: string,
  extraBattleTypes: BattleType[] = [],
): MapDetail {
  const { width, height } = dimensions(arena);
  return {
    ...buildMapSummary(arena, slug, extraBattleTypes),
    description: arena.description,
    roundLength: arena.roundLength,
    maxPlayersInTeam: arena.maxPlayersInTeam,
    widthMeters: width,
    heightMeters: height,
    geometry: buildGeometry(arena),
    onslaught: buildOnslaught(arena),
  };
}
