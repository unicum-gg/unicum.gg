import {
  listRecentVideos,
  listVideoBattles,
} from "@unicum.gg/core/tanks/videos-read";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import {
  CommunityVideosQuery,
  CommunityVideosResponse,
} from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Community videos
 * @description Every published battle the community has suggested, newest approved first, whatever the tank. Each entry is a battle rather than a whole video, carrying the second it starts at, so one recording appears once per battle marked in it. The per-tank endpoint returns the same rows filtered to one tank; this one is what shows a video whole, with every tank it covers. Region-independent, the same list is served on every region.
 * @pathParams regionParams
 * @queryParams CommunityVideosQuery
 * @response CommunityVideosResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/videos", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  // Narrowed to one recording, which is a different question from "what is
  // new": those come back in the order they happen, uncapped, because that is
  // what a seek bar draws.
  const { videoId } = CommunityVideosQuery.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const videos = videoId
    ? await listVideoBattles(region, videoId)
    : await listRecentVideos(region);
  return jsonResponse(
    CommunityVideosResponse,
    { videos },
    {
      // Cached by a CDN, revalidated by the browser. A held browser copy is
      // actively wrong here: the submitter of a queued row watches it turn
      // from "waiting on a moderator" into a published one, and their own
      // queue is uncached, so a stale list makes the row vanish at the exact
      // moment it goes live. `s-maxage` keeps the shared cache doing its job.
      headers: {
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
