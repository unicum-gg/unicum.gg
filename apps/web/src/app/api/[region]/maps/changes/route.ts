import {
  getPendingMapChanges,
  getRecentMapChanges,
} from "@unicum.gg/core/wargaming/wot/maps/history-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { MapChangesResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Map changes feed
 * @description The global map-change feed: what every game version changed about the game's maps, newest version first and most-changed map first, plus what the running Common Test build is about to change. Play areas resized, game modes and battle types gained or lost, random events added to or dropped from a map, bases, spawns, control points and Onslaught points of interest moved, and maps added to or pulled from the client. Reconstructed from the client's own arena definitions, which Wargaming publishes no archive of. Limited to the maps the region's catalogue currently lists.
 * @pathParams regionParams
 * @response MapChangesResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/changes", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  // Sequential on purpose: both start from the region's map catalogue, whose
  // memo has no in-flight dedupe, so running them together would build it twice
  // on a cold cache (hundreds of mirror fetches) for no overlap to win back.
  const versions = await getRecentMapChanges(region);
  const pending = await getPendingMapChanges(region);
  return jsonResponse(
    MapChangesResponse,
    { testVersion: pending.version, testMaps: pending.maps, versions },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
