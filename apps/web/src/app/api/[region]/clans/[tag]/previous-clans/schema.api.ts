// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Reuses the
// `previousClan` sub-schema from the clan detail.
import { z } from "zod";
import { previousClan } from "../schema.api";

/** Response of `GET /{region}/clans/{tag}/previous-clans`. */
export const ClanPreviousClansResponse = z.object({
  previousClans: z.array(previousClan),
});
