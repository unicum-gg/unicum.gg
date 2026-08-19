import { getRecentSpecChanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-history-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { TankChangesResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tank changes feed
 * @description The global tank-rebalance feed for a region: recent characteristic changes across every tank, grouped by game version (newest first) and then by tank (heaviest-hit first). Firepower, gun handling, mobility, survivability and concealment buffs and nerfs, as Wargaming ships them. Identity comes from the region's own catalogue, so a tank absent from a server is left out of that server's feed. Values are raw stored values; apply each field's scale to display.
 * @pathParams regionParams
 * @response TankChangesResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/changes", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const versions = await getRecentSpecChanges(region);
  return jsonResponse(
    TankChangesResponse,
    { versions },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
