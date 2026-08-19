import { isRegion } from "@unicum.gg/wargaming";
import { listMapSummaries } from "@unicum.gg/core/wargaming/wot/maps";
import { jsonResponse } from "@/services/openapi/json-response";
import { MapsListResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Maps
 * @description Every World of Tanks battle map on a region: display name, minimap image, camouflage kind (summer/winter/desert), square size in metres, and the random-battle modes it supports (Standard/Encounter/Assault). Derived from the game client scripts, so removed or event-reskin maps are included. One entry per distinct map, name-sorted.
 * @pathParams regionParams
 * @response MapsListResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const maps = await listMapSummaries(region);
  return jsonResponse(
    MapsListResponse,
    { results: maps },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
