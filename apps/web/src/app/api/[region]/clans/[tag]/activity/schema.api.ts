// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Reuses the
// `clanEvent` sub-schema from the clan detail.
import { z } from "zod";
import { clanEvent } from "../schema.api";

/** Response of `GET /{region}/clans/{tag}/activity`. */
export const ClanActivityResponse = z.object({
  events: z.array(clanEvent),
});
