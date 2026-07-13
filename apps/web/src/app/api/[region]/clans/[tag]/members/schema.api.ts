// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Reuses
// the `clanMember` sub-schema from the clan detail, so the shape is defined once.
import { z } from "zod";
import { clanMember } from "../schema.api";

/** Response of `GET /{region}/clans/{tag}/members`. */
export const ClanMembersResponse = z.object({
  members: z.array(clanMember),
});
