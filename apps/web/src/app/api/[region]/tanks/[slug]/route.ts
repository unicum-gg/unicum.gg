import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankPerfRow } from "../categories.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tank performance
 * @description Server-wide performance for one tank on a region, averaged over tracked players (win rate, average damage, WN7/WN8/WNX, and more), plus Marks of Excellence / Mastery holder counts. 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @response TankPerfRow
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const row = await getTankRow(region, decodeURIComponent(slug));
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(
    tankPerfRow,
    { identity: row.identity, stats: row.stats },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
