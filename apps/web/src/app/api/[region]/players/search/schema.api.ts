// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty. Keeping
// it a separate, server-free module (only zod + shared schemas) means client
// components can import it too (see the clan/player detail routes).
import { z } from "zod";
import { playerSummary } from "@/services/openapi/schemas";

/** Response of `GET /{region}/players/search` (the combined, non-streamed set). */
export const PlayerSearchResponse = z.object({
  results: z.array(playerSummary),
});
