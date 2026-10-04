import { isRegion } from "@unicum.gg/wargaming";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getMapRatingSummary } from "@unicum.gg/core/maps/ratings-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { MapRatingsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Map community rating
 * @description What players make of one map, and what that verdict is built on. The same machinery as the vehicle ratings, with one honest difference: Wargaming publishes no per-arena record, so a vote cannot be gated on having played this map and is gated on the account's own battle count instead, which the rotation makes a fair proxy since nobody chooses where they are sent. What the response does carry is who is saying it, split by how well the voters play and by which server they play on, alongside the star histograms and the optional per-axis radar. There is no `hype` here and there cannot be: that column compares a reputation to a measured win rate, and no per-arena win rate exists anywhere. Region-independent, the same verdict is served everywhere; the region in the path only resolves the slug.
 * @pathParams mapParams
 * @response MapRatingsResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/{slug}/ratings", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const summary = await getMapRatingSummary(map.arenaId);
  return jsonResponse(MapRatingsResponse, summary, {
    // Short and shared-only, like the vehicle summary and the video list:
    // someone who has just voted reloads to see their star land in the
    // histogram, and a held browser copy would show them the count from before
    // they pressed it. The CDN still absorbs the traffic of everyone who did
    // not vote.
    headers: {
      "cache-control":
        "public, max-age=0, s-maxage=120, stale-while-revalidate=60",
    },
  });
}
