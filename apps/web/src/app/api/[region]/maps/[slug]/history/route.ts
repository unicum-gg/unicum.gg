import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getMapHistory } from "@unicum.gg/core/wargaming/wot/maps/history-read";
import { getMapTestChanges } from "@unicum.gg/core/wargaming/wot/maps/test-changes";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { MapHistoryResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Map changes history
 * @description Everything a map has been through across game versions, grouped by version, newest first: play area resized, game modes and battle types gained or lost, random events added or dropped, bases, spawns, control points and Onslaught points of interest moved, and the map entering or leaving the client. Reconstructed from the client's own arena definitions back to update 1.13.0, plus what the running Common Test is about to change. 404 when the slug maps to no map on the region.
 * @pathParams mapParams
 * @response MapHistoryResponse
 * @tag Maps
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maps/{slug}/history", () => GET__perf(...args));
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
  if (!map) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const [history, test] = await Promise.all([
    getMapHistory(map.arenaId, map.night?.arenaId ?? null),
    getMapTestChanges(map.arenaId),
  ]);
  return jsonResponse(
    MapHistoryResponse,
    {
      arenaId: map.arenaId,
      slug: map.slug,
      name: map.name,
      versions: history.versions,
      addedVersion: history.addedVersion,
      addedAt: history.addedAt,
      removedVersion: history.removedVersion,
      removedAt: history.removedAt,
      present: history.present,
      tracked: history.tracked,
      testVersion: test.version,
      testChanges: test.changes,
    },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
