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
  /** This map's night version for Onslaught, when it has one. It is an arena of
   * its own, so the gallery links straight to its view and draws the minimap the
   * layout itself resolved rather than guessing it from the id. Null on every
   * map without one. */
  night: { arenaId: string; minimapUrl: string } | null;
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

export type MapDetail = MapSummary & {
  description: string;
  /** Battle timer in seconds. */
  roundLength: number;
  maxPlayersInTeam: number;
  widthMeters: number;
  heightMeters: number;
  geometry: MapModeGeometry[];
  /** The map's Onslaught layouts, newest last, empty when it has none. Usually
   * one, the mode its own arena definition declares. A map with a night version
   * carries that arena's layout as a second entry: same map, own space, own
   * points. */
  onslaught: MapOnslaught[];
  /** The random events that might fire on the map mid-battle; empty on the maps
   * that have none. */
  randomEvents: MapRandomEvent[];
};
