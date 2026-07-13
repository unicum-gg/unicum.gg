// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";
import { playerSummary } from "@/services/openapi/schemas";

/** Response of `GET /{region}/players/top` (the player leaderboard). */
export const TopPlayersResponse = z.object({
  results: z.array(playerSummary),
  computed_at: z.string().nullable(),
});
