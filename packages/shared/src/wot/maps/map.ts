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
};

// An Onslaught capturable point of interest, projected onto the minimap. `type`
// mirrors the game's `pointsOfInterestUDO` type: 1 = strike, 2 = recon.
export type MapPoi = { marker: MapMarker; type: number };

// The Onslaught (comp7) variant of a map: its own reduced play area, minimap and
// geometry (a central control point with per-team spawns). Present only on maps
// that support Onslaught.
export type MapOnslaught = {
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
  /** Onslaught-specific minimap + geometry, or null when the map has no
   * Onslaught configuration. */
  onslaught: MapOnslaught | null;
  /** The random events that might fire on the map mid-battle; empty on the maps
   * that have none. */
  randomEvents: MapRandomEvent[];
};
