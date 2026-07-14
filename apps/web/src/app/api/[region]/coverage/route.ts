import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { getCoverageStats } from "@/services/coverage";
import { CoverageResponse } from "./schema.api";

/**
 * Coverage
 * @description How much of the region the tracker covers: player/clan/snapshot counts, refresh-policy health (per activity bucket), 30-day discovery and snapshot trends, and infrastructure size/cost. Cached for 60s server-side. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response CoverageResponse
 * @openapi
 * @tag System
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const stats = await getCoverageStats(region);
  return jsonResponse(CoverageResponse, stats);
}
