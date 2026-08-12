// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the map page parses with it.
import { z } from "zod";
import { videoBattleWithTank } from "@/services/openapi/schemas";

/** Response of `GET /{region}/maps/{slug}/videos`: every published battle fought
 * on this map, whatever it was played in and whatever format it was played in.
 * The page filters; the endpoint answers with the map's whole record. */
export const MapVideosResponse = z.object({
  videos: z.array(videoBattleWithTank),
});
