import { isRegion } from "@unicum.gg/wargaming";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { listMapVideos } from "@unicum.gg/core/tanks/videos-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { MapVideosResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Map videos
 * @description Every published battle the community has linked on this map, newest approved first, whatever format it was played in and whatever it was played in. This is the read behind a tactic library: a Clan Wars or Advances battle is filed under the ground it was fought on and the side it was fought from, not under a vehicle, so the map is the only page it can be looked up from. Random battles come back alongside them, carrying the tank they were played in, and the page filters by format.
 * @pathParams mapParams
 * @response MapVideosResponse
 * @tag Maps
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const videos = await listMapVideos(region, map.arenaId);

  return jsonResponse(
    MapVideosResponse,
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
