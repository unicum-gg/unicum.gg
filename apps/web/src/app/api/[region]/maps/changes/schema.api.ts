// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { changedMap, mapChangesVersion } from "../changes.api";

/** Response of `GET /{region}/maps/changes`: the global map-change feed,
 * grouped by game version (newest first), plus what the running Common Test is
 * about to change (not history: it has not shipped). */
export const MapChangesResponse = z.object({
  testVersion: z.string().nullable().meta({
    description:
      "The Common Test build the pending changes were read from, null when no test is running.",
  }),
  testMaps: z.array(changedMap),
  versions: z.array(mapChangesVersion),
});
