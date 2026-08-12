// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { TankVideosResponse } from "../schema.api";

/**
 * Response of `GET /{region}/tanks/{slug}/videos/mine`: the signed-in user's
 * own queued battles for this tank.
 *
 * Same shape as the published list, so the page can render both through one
 * component: what differs is not the row but whether it is live yet.
 */
export const MyTankVideosResponse = TankVideosResponse;
