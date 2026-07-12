import { NextResponse } from "next/server";
import { getCachedLiveStreamers } from "@/services/twitch";

// Polled by the home rail so live status stays fresh on the otherwise-static
// page. Runs per request but `getCachedLiveStreamers` dedupes the Twitch work
// to ~one poll per 30s regardless of how many clients are watching.
export const dynamic = "force-dynamic";

/**
 * Live streamers
 * @description Tracked players live on Twitch in the World of Tanks category across all regions, with cached WN7/WN8/WNX ratings and clan tag, sorted by WNX (empty when nobody tracked is live).
 * @response LiveStreamersResponse
 * @tag System
 * @openapi
 */
export async function GET() {
  const streamers = await getCachedLiveStreamers();
  return NextResponse.json(streamers, {
    headers: { "Cache-Control": "no-store" },
  });
}
