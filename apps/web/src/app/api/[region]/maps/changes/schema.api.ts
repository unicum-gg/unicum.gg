// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { mapChangesVersion } from "../changes.api";

/** Response of `GET /{region}/maps/changes`: the global map-change feed,
 * grouped by game version (newest first). */
export const MapChangesResponse = z.object({
  versions: z.array(mapChangesVersion),
});
