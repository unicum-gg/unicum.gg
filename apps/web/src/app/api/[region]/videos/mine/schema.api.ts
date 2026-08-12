// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { videoBattleWithTank } from "@/services/openapi/schemas";

/**
 * Response of `GET /{region}/videos/mine`: the signed-in user's own queued
 * battles, wherever they were filed.
 *
 * Same row as every published list, so a page can render both through one
 * component: what differs is not the row but whether it is live yet.
 */
export const MyVideosResponse = z.object({
  videos: z.array(videoBattleWithTank),
});
