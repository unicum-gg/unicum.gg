import { getCachedLiveStreamers } from "@/services/twitch";
import { jsonResponse } from "@/services/openapi/json-response";
import { LiveStreamersResponse } from "./schema.api";

/**
 * Live streamers
 * @description Tracked players currently live on Twitch, across all regions, with their WN7/WN8/WNX ratings. Snapshot form of the `/streamers/live/sse` stream; cached ~30s server-side.
 * @response LiveStreamersResponse
 * @tag Streamers
 * @openapi
 */
export async function GET() {
  const results = await getCachedLiveStreamers();
  return jsonResponse(LiveStreamersResponse, { results });
}
