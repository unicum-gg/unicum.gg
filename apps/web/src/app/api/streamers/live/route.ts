import { NextResponse } from "next/server";
import { getCachedLiveStreamers } from "@/services/twitch";

// Public JSON snapshot of who's live. The site's own UI streams live updates
// over `/api/streamers/live/sse` instead; this stays a plain cached endpoint for
// API consumers. `getCachedLiveStreamers` dedupes the Twitch work to ~one poll
// per 30s regardless of how many clients hit it.
export const dynamic = "force-dynamic";

/**
 * Live streamers
 * @description Tracked players live on Twitch in the World of Tanks category across all regions, with cached WN7/WN8/WNX ratings and clan tag, sorted by WNX (empty when nobody tracked is live).
 * @response LiveStreamersResponse
 * @tag Streamers
 * @openapi
 */
export async function GET() {
  const streamers = await getCachedLiveStreamers();
  return NextResponse.json(streamers, {
    headers: { "Cache-Control": "no-store" },
  });
}
