import { listRecentVideos } from "@unicum.gg/core/tanks/videos";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { CommunityVideosResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Community videos
 * @description Every published battle the community has suggested, newest approved first, whatever the tank. Each entry is a battle rather than a whole video, carrying the second it starts at, so one recording appears once per battle marked in it. The per-tank endpoint returns the same rows filtered to one tank; this one is what shows a video whole, with every tank it covers. Region-independent, the same list is served on every region.
 * @pathParams regionParams
 * @response CommunityVideosResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const videos = await listRecentVideos(region);
  return jsonResponse(
    CommunityVideosResponse,
    { videos },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
