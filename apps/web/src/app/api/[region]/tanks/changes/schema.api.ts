// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankChangesVersion } from "../changes.api";

/** Response of `GET /{region}/tanks/changes`: the global tank-rebalance feed,
 * grouped by game version (newest first). */
export const TankChangesResponse = z.object({
  versions: z.array(tankChangesVersion),
});
