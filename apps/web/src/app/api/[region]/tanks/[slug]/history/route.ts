import { getTankSpecHistory } from "@unicum.gg/core/wargaming/wot/tanks/spec-history-read";
import { getTestChanges } from "@unicum.gg/core/wargaming/wot/tanks/test-changes";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { TankHistoryResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tank changes history
 * @description The characteristic changes a tank has gone through across game versions (buffs and nerfs to firepower, gun handling, mobility, survivability and concealment), grouped by version, newest first. Built forward from the moment tracking started, since Wargaming publishes no archive of past client versions. Values are raw stored values; apply each field's scale to display. 404 when the slug maps to no tank on the region.
 * @pathParams tankParams
 * @response TankHistoryResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/history", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const history = await getTankSpecHistory(region, decodeURIComponent(slug));
  if (!history) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const test = await getTestChanges(history.tankId);
  return jsonResponse(
    TankHistoryResponse,
    {
      tankId: history.tankId,
      slug: history.slug,
      versions: history.versions,
      testVersion: test.version,
      testChanges: test.changes,
      devVersion: history.devVersion,
      devAt: history.devAt,
      releasedVersion: history.releasedVersion,
      releasedAt: history.releasedAt,
    },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
