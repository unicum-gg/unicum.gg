import type { WotSrcArena } from "@unicum.gg/wargaming";
import { BattleType, battleTypesForArena } from "./battle-types";
import { mapCamouflage } from "./camouflage";
import { gameModeFromRaw } from "./game-modes";
import type { MapPoint } from "./geometry";
import { buildRandomEvents } from "./random-events";
import { MIRROR_TRACKING_START } from "../mirror-tracking";

/**
 * The oldest game version the map history covers. A map already in the client
 * then predates our tracking, so all we can say is that it was added *before*
 * that update.
 */
export const MAP_HISTORY_TRACKING_START = MIRROR_TRACKING_START;

/**
 * A point of a map's geometry, in metres from the bottom-left corner of the play
 * area rather than in world coordinates.
 *
 * This is the one normalization the whole history depends on. Wargaming
 * regularly re-centres a map's world origin without touching the map itself
 * (Czechoslovakia's play area moved from `-400..600` to `-500..500` on X, and
 * every base, spawn and control point moved by exactly -100 with it), which in
 * world coordinates reads as "every marker on the map moved" and in fact reads
 * as nothing at all. Anchoring on the play area's corner cancels that shift, so
 * only a real move survives the diff.
 */
export type MapHistoryPoint = { x: number; z: number };

/**
 * A map's tracked state at one game version: everything about it we can tell a
 * player changed, and nothing that only moves because the client's internals
 * did. Geometry keys are `<gameplay token>:<bases|spawns>:<team1|team2>`,
 * `<token>:controlPoint` and `<token>:pointsOfInterest`, so a mode that appears
 * or disappears takes its geometry with it.
 */
export type MapSnapshotData = {
  /** Localized display name. A map keeps its id across a rename, and Wargaming
   * also re-uses a retired map's id for a brand new one, so the name is what
   * tells the two apart (see `isSameMap`). */
  name: string;
  camouflage: string;
  /** Battle timer in seconds. */
  roundLength: number;
  maxPlayersInTeam: number;
  /** Play area in metres. 0 when the client ships no arena definition. */
  widthMeters: number;
  heightMeters: number;
  /** Random-battle modes the map offers (`standard`, `encounter`, `assault`),
   * sorted. The gameplay tokens that are not random modes (`comp7`, `epic`,
   * `ctf30x30`) are not repeated here: they are what the battle types below say,
   * in words a player uses. */
  modes: string[];
  /** Battle types the map belongs to (`random`, `onslaught`, ...), sorted. */
  battleTypes: string[];
  /** Names of the random events the map can run mid-battle, sorted. Names rather
   * than ids because they are what a reader sees and they are already unique
   * within a map (the builder numbers two events that would read alike), so the
   * feed needs no context to tell "Airship Crash 1" from "Airship Crash 2".
   *
   * Optional on purpose: the snapshots taken before events were tracked do not
   * carry the field, and an absent field means "not known" rather than "none".
   * Diffing the two the same way would announce every event on every map as
   * newly added the day this shipped. */
  randomEvents?: string[];
  /** Whether the client shipped an `arena_defs` file for the map at that
   * version. A map known only from the localization has no geometry, no modes
   * and no play area, and the difference between that and a real definition is
   * a gap in what we can read, not a change to the map. */
  defined: boolean;
  /** Play area of the modes that ship one of their own (Onslaught's `comp7` is
   * fought on a reduced part of the map), in metres, keyed by gameplay token.
   * The modes that use the arena's own area are not repeated here: that is
   * `widthMeters` / `heightMeters` above. */
  boxes: Record<string, { width: number; height: number }>;
  geometry: Record<string, MapHistoryPoint[]>;
};

/**
 * Gameplay tokens whose geometry is not tracked.
 *
 * They are configurations rather than modes anyone plays for: a Training Room
 * borrows whichever map it is held on (and its bases sit a couple of metres from
 * the standard ones), while the bootcamp and sandbox entries exist for the
 * tutorial and Wargaming's own test builds. Their markers move with the client's
 * internals and mean nothing to a reader.
 */
const UNPLAYED_MODES = new Set([
  "maps_training",
  "bootcamp",
  "rts_bootcamp",
  "sandbox",
]);

/** The client's `pointsOfInterestUDO` type for a recon point; anything else is a
 * strike point. */
const POI_RECON_TYPE = 2;

/** Round to a tenth of a metre: below that, a coordinate difference is float
 * noise from the client's own re-exports, not a moved marker. */
const roundM = (v: number) => Math.round(v * 10) / 10;

function relative(points: MapPoint[], origin: MapPoint): MapHistoryPoint[] {
  return points.map((p) => ({
    x: roundM(p.x - origin.x),
    z: roundM(p.z - origin.z),
  }));
}

/**
 * Build a map's tracked state from the client's arena definition.
 *
 * Onslaught (`comp7`) ships its own reduced play area, so its geometry is
 * anchored on that box rather than the arena's: a change to the standard play
 * area must not read as "every Onslaught spawn moved".
 */
export function buildMapSnapshotData(arena: WotSrcArena): MapSnapshotData {
  const bb = arena.boundingBox;
  const geometry: Record<string, MapHistoryPoint[]> = {};
  const boxes: MapSnapshotData["boxes"] = {};

  for (const g of arena.gameplay) {
    if (UNPLAYED_MODES.has(g.mode)) continue;
    const box = g.boundingBox ?? bb;
    if (!box) continue;
    if (g.boundingBox) {
      boxes[g.mode] = {
        width: Math.round(g.boundingBox.upperRight.x - g.boundingBox.bottomLeft.x),
        height: Math.round(g.boundingBox.upperRight.z - g.boundingBox.bottomLeft.z),
      };
    }
    const origin = box.bottomLeft;
    const put = (key: string, points: MapPoint[]) => {
      if (points.length > 0) geometry[`${g.mode}:${key}`] = relative(points, origin);
    };
    put("bases:team1", g.bases.team1);
    put("bases:team2", g.bases.team2);
    put("spawns:team1", g.spawns.team1);
    put("spawns:team2", g.spawns.team2);
    put("controlPoint", g.controlPoint ? [g.controlPoint] : []);
    // Onslaught's two kinds of capturable point are different objectives with
    // different capture radii, and the game draws them with different icons, so
    // they are tracked apart: a recon point moving is not a strike point moving.
    put(
      "pointsOfInterest:strike",
      g.pointsOfInterest.filter((poi) => poi.type !== POI_RECON_TYPE).map((poi) => poi.position),
    );
    put(
      "pointsOfInterest:recon",
      g.pointsOfInterest.filter((poi) => poi.type === POI_RECON_TYPE).map((poi) => poi.position),
    );
  }

  return {
    name: arena.name,
    camouflage: mapCamouflage(arena.camouflage),
    defined: arena.hasDefinition,
    roundLength: arena.roundLength,
    maxPlayersInTeam: arena.maxPlayersInTeam,
    widthMeters: bb ? Math.round(bb.upperRight.x - bb.bottomLeft.x) : 0,
    heightMeters: bb ? Math.round(bb.upperRight.z - bb.bottomLeft.z) : 0,
    modes: [
      ...new Set(
        arena.gameplay.flatMap((g) => gameModeFromRaw(g.mode) ?? []),
      ),
    ].sort(),
    battleTypes: battleTypesForArena(
      arena.arenaId,
      arena.gameplay.map((g) => g.mode),
      arena.maxPlayersInTeam,
    )
      // A Training Room can be held on any random map, so this one never moves
      // on its own: it is added and removed with Random, and reporting both says
      // the same thing twice.
      .filter((t) => t !== BattleType.Training)
      .sort(),
    // Read off the arena rather than off the catalogue's `randomEvents`, which
    // is gated on the map being played in Random Battles: here the layers are
    // the record, and a map that stops being a random map is already reported by
    // its battle types.
    randomEvents: buildRandomEvents(arena.arenaId, arena.minimapLayers)
      .map((e) => e.name)
      .sort(),
    boxes,
    geometry,
  };
}

/**
 * Whether two snapshots of the same arena id are the same map.
 *
 * Arena ids are re-used: the Grand Battle arena `212_epic_random_valley_sm25`
 * came back as the Story Mode map Nebelburg. Diffing across such a swap would
 * invent a rework that never happened, so a changed name starts a fresh baseline
 * instead (the tank history does the same with a vehicle's tag). A rename of the
 * map itself is rare enough, and the alternative (silently diffing two unrelated
 * maps) is far worse than recording one extra introduction.
 */
export function isSameMap(a: MapSnapshotData, b: MapSnapshotData): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}
