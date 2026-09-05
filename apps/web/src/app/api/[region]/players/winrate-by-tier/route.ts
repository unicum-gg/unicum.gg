import { loadTierWinrate } from "@unicum.gg/core/players/tier-winrate";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { TierWinrateResponse } from "./schema.api";

/**
 * Win rate by tier and rating band
 * @description What each band of the region's players wins at each tier: the band's wins at that tier over its battles there. Rebuilt nightly as a by-product of the pass over the per-vehicle snapshots, the only place a win rate per tier exists. 404 until the first run. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response TierWinrateResponse
 * @openapi
 * @tag Players
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/winrate-by-tier", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const grid = await loadTierWinrate(region);
  // No rows yet: the nightly pass has not run for this region since the grid
  // was added. A 404 rather than an empty grid, so the page renders nothing
  // instead of a wall of dashes that would read as "nobody wins anything".
  if (!grid) {
    return Response.json({ error: "not_computed" }, { status: 404 });
  }
  return jsonResponse(TierWinrateResponse, grid);
}
