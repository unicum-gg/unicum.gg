import { isRegion } from "@unicum.gg/wargaming";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { jsonResponse } from "@/services/openapi/json-response";
import { MapDetailResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Map detail
 * @description A single battle map with its full geometry: display name, description, minimap image, camouflage kind, size in metres, battle timer, team size, and per-mode base flags, team spawns and control point projected onto the minimap as percentage coordinates. `slug` in the response is the canonical slug.
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

  return jsonResponse(MapDetailResponse, detail, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
