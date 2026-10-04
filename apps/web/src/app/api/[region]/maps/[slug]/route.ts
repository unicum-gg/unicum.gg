import { isRegion } from "@unicum.gg/wargaming";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getMapRatingHeadline } from "@unicum.gg/core/maps/ratings-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { MapDetailResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Map detail
 * @description A single battle map with its full geometry: display name, description, minimap image, camouflage kind, size in metres, battle timer, team size, and per-mode base flags, team spawns and control point projected onto the minimap as percentage coordinates. `randomEvents` carries the events that might fire on the map mid-battle, each with the minimap art of its danger area and of the ground it leaves behind. `rating` is the community verdict in three numbers, for a caller that needs a score and a count rather than the whole thing. `slug` in the response is the canonical slug.
 * @pathParams mapParams
 * @response MapDetailResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/{slug}", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const detail = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!detail) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Three numbers rather than the whole verdict. The map page's layout prints a
  // vote count on its tab bar, which renders on every tab of every map: asking
  // the ratings endpoint there would be a second SSR self-fetch per render,
  // pulling back two histograms, two splits and thirty review bodies to print
  // one. This is a single grouped scan of an indexed column.
  const rating = await getMapRatingHeadline(detail.arenaId);

  return jsonResponse(MapDetailResponse, { ...detail, rating }, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
