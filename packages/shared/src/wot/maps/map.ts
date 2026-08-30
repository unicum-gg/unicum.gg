import type { BattleType } from "./battle-types";
import type { MapCamouflage } from "./camouflage";
import type { MapGameMode } from "./game-modes";
import type { MapMarker } from "./geometry";
import type { MapRandomEvent } from "./random-events";

export type MapModeGeometry = {
  mode: MapGameMode;
  label: string;
  bases: { team1: MapMarker[]; team2: MapMarker[] };
  spawns: { team1: MapMarker[]; team2: MapMarker[] };
  controlPoint: MapMarker | null;
};

export type MapSummary = {
  arenaId: string;
  slug: string;
  name: string;
  camouflage: MapCamouflage;
  /** Square side length in metres (max of width/height, rounded). */
  sizeMeters: number;
  modes: MapGameMode[];
  /** Top-level battle types the map belongs to (Random, Battle Royale, ...). */
  battleTypes: BattleType[];
  minimapUrl: string;
  /** Base positions of the primary (Standard) mode, so the gallery thumbnail can
   * show where the bases are without loading the full per-mode geometry. */
  bases: { team1: MapMarker[]; team2: MapMarker[] };
  /** Whether random events might fire on the map mid-battle, so the gallery can
   * flag it without carrying the events themselves. */
  hasRandomEvents: boolean;
  /** Whether only the Common Test client ships this map's space: the live client
   * declares the arena but carries nothing to load, so it cannot be played there
   * yet. Its minimap comes from the test branch of the mirror for the same
   * reason. */
  commonTest: boolean;
  /** The map's variants: the arenas the client ships under this map's name for
   * an event or a mode of their own (Waffenträger, Last Stand, Story Mode, the
   * Onslaught night versions). They are views of this map rather than maps, so
   * the gallery reads them here to draw the right minimap on the right tab and
   * link straight to the matching view. */
  variants: MapVariantSummary[];
};

/** One variant of a map, as the gallery needs it. */
export type MapVariantSummary = {
  /** The arena the variant is, which is a different space from the map's own. */
  arenaId: string;
  /** What it is played as, which names its tab and keys its view. */
  battleType: BattleType;
  minimapUrl: string;
  /** Whether only the Common Test client ships its space, so it cannot be
   * played on a live server yet. */
  commonTest: boolean;
};

// An Onslaught capturable point of interest, projected onto the minimap. `type`
// mirrors the game's `pointsOfInterestUDO` type, kept as the raw number so a
// kind the game adds still reaches the client (see `MapPoiType`).
export type MapPoi = { marker: MapMarker; type: number };

// One Onslaught (comp7) layout of a map: its own reduced play area, minimap and
// geometry (a central control point with per-team spawns).
export type MapOnslaught = {
  /** The arena the layout is read from. The map's own id for the Onslaught mode
   * its arena definition declares, or the id of the night arena the client ships
   * beside it, which is a different space with its own minimap. */
  arenaId: string;
  minimapUrl: string;
  widthMeters: number;
  heightMeters: number;
  spawns: { team1: MapMarker[]; team2: MapMarker[] };
  controlPoint: MapMarker | null;
  pointsOfInterest: MapPoi[];
};

/** One variant of a map with everything a view of it needs: it is a whole arena,
 * so it has its own play area, its own modes and possibly its own Onslaught
 * layout (the night versions are exactly that). */
export type MapVariantLayout = MapVariantSummary & {
  widthMeters: number;
  heightMeters: number;
  /** The random-battle modes the variant's own arena declares. Empty on the ones
   * that declare none (an Onslaught night arena has only `comp7`). */
  geometry: MapModeGeometry[];
  /** Its Onslaught layout, when its arena declares one. */
  onslaught: MapOnslaught | null;
};

export type MapDetail = MapSummary & {
  description: string;
  /** Battle timer in seconds. */
  roundLength: number;
  maxPlayersInTeam: number;
  widthMeters: number;
  heightMeters: number;
  geometry: MapModeGeometry[];
  /** The Onslaught layout the map's own arena definition declares, or null. A
   * night version's layout is not here: it is a different arena, and lives in
   * `variants` with everything else the map is played as elsewhere. */
  onslaught: MapOnslaught | null;
  /** The map's variants in full: each is its own arena, drawn as its own view.
   * Ordered as the battle types are declared, so a page renders them the same
   * way the gallery tabs do. */
  variants: MapVariantLayout[];
  /** The random events that might fire on the map mid-battle; empty on the maps
   * that have none. */
  randomEvents: MapRandomEvent[];
};
