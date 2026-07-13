// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { clanSummary } from "@/services/openapi/schemas";

/** Response of `GET /{region}/clans/top` (the clan leaderboard). */
export const TopClansResponse = z.object({
  results: z.array(clanSummary),
  computed_at: z.string().nullable(),
});
