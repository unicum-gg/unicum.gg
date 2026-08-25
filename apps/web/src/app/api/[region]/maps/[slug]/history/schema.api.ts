// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapChange, mapHistoryVersion } from "../../changes.api";

/** Response of `GET /{region}/maps/{slug}/history`: everything recorded about
 * one map, newest version first. */
export const MapHistoryResponse = z.object({
  arenaId: z.string(),
  slug: z.string(),
  name: z.string(),
  versions: z.array(mapHistoryVersion),
  addedVersion: z.string().nullable().meta({
    description:
      "The game version the map entered the client in, or null when it predates our version tracking (in which case it was there before the first tracked update).",
  }),
  addedAt: z.coerce.date().nullable(),
  removedVersion: z.string().nullable().meta({
    description:
      "The game version that pulled the map from the client, when it is currently gone. Seasonal maps come back, so this is a state rather than an end.",
  }),
  removedAt: z.coerce.date().nullable(),
  present: z.boolean().meta({
    description: "Whether the client currently ships the map.",
  }),
  tracked: z.boolean().meta({
    description:
      "Whether the map has ever been recorded. False for the arenas the client names but does not define, which have no geometry to compare and no knowable introduction.",
  }),
  /** What the running Common Test changes about this map, if anything. Not
   * history: it has not shipped, and may still be re-cut or dropped. */
  testVersion: z.string().nullable().meta({
    description: "The Common Test build these pending changes were read from.",
  }),
  testChanges: z.array(mapChange),
});
