// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";
import { playerSummary } from "@/services/openapi/schemas";

/** Response of `GET /{region}/players/top` (the player leaderboard). */
export const TopPlayersResponse = z.object({
  results: z.array(playerSummary),
  computed_at: z.string().nullable(),
  /**
   * Rows this board holds, counted no deeper than its own published depth, so a
   * caller can page through it without fetching the whole ranking to find out
   * how long it is. Absent on the boards that have no bounded count to give.
   */
  total: z.number().int().optional(),
});
