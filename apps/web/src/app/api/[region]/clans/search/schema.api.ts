// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { clanSummary } from "@/services/openapi/schemas";

/** Response of `GET /{region}/clans/search` (the combined, non-streamed set). */
export const ClanSearchResponse = z.object({ results: z.array(clanSummary) });
