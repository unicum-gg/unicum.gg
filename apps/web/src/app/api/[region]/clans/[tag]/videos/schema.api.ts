// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the clan page parses with it.
import { z } from "zod";
import { videoBattleWithTank } from "@/services/openapi/schemas";

/** Response of `GET /{region}/clans/{tag}/videos`: every published battle this
 * clan is credited on. */
export const ClanVideosResponse = z.object({
  videos: z.array(videoBattleWithTank),
});
