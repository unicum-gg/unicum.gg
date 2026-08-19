import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankMoeRow } from "../../categories.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tank Marks of Excellence
 * @description The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on one tank of a region (mirrored per region). 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @response TankMoeRow
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/marks-of-excellence", () => GET__perf(...args));
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
    tankMoeRow,
    { identity: row.identity, moe: row.moe },
    { headers: { "cache-control": "public, max-age=600" } },
  );
}
