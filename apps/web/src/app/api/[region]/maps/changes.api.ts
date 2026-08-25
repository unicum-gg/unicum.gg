// Shared schemas for the map change history: the per-map History tab
// (`/{region}/maps/{slug}/history`) and the global feed (`/{region}/maps/changes`).
// `.api.ts` so next-openapi-gen scans it.
import { z } from "zod";

/** One recorded change to a map at a game-version bump. Values are strings
 * because a map has no single kind of characteristic: a number, a camouflage
 * token, a presence sentinel, or a serialized list of marker positions. */
export const mapChange = z
  .object({
    field: z.string(),
    previous: z.string().nullable(),
    next: z.string().nullable(),
  })
  .meta({
    id: "MapChange",
    description:
      "A change to one map property between two game versions, with the before/after values. `field` is a tracked scalar (roundLength, widthMeters, heightMeters, maxPlayersInTeam, camouflage), a mode or battle type the map gained or lost (mode:standard, battleType:onslaught), a mode's play area (playArea:comp7), a marker group (geometry:ctf:bases:team1, whose value is a JSON array of [x, z] positions in metres from the play area's bottom-left corner), or the map entering or leaving the client (presence). Either side is null when the property did not exist then.",
  });

/** A game version and the changes it brought to one map (per-map view). */
export const mapHistoryVersion = z
  .object({
    gameVersion: z.string(),
    capturedAt: z.coerce.date(),
    changes: z.array(mapChange),
  })
  .meta({
    id: "MapHistoryVersion",
    description:
      "The changes a game version made to a map, with when they were recorded.",
  });

/** A map and its changes within a version (global feed view). */
export const changedMap = z
  .object({
    arenaId: z.string(),
    slug: z.string(),
    name: z.string(),
    minimapUrl: z.string(),
    changes: z.array(mapChange),
  })
  .meta({
    id: "ChangedMap",
    description: "A map and the changes a game version made to it.",
  });

/** A game version and every map it changed (global feed). */
export const mapChangesVersion = z
  .object({
    gameVersion: z.string(),
    capturedAt: z.coerce.date(),
    maps: z.array(changedMap),
  })
  .meta({
    id: "MapChangesVersion",
    description:
      "Every map a game version changed, newest version first, most-changed map first.",
  });
