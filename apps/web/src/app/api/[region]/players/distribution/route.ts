import { loadPlayerDistribution } from "@unicum.gg/core/players/distribution";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { PlayerDistributionResponse } from "./schema.api";

/**
 * Player distribution
 * @description How the region's tracked players are spread across win rate and WNX, as histograms, and how its battles are spread across tiers and vehicle classes. Materialised hourly rather than read live: the histograms are a full scan of the region's players. 404 until the first run. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response PlayerDistributionResponse
 * @openapi
 * @tag Players
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/distribution", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const distribution = await loadPlayerDistribution(region);
  // No row yet: the cron has not run for this region. A 404 rather than an
  // empty shape, so a caller can tell "nothing computed" from "a region where
  // nobody plays", and so the page renders its own waiting state instead of a
  // histogram of zeros.
  if (!distribution) {
    return Response.json({ error: "not_computed" }, { status: 404 });
  }
  return jsonResponse(PlayerDistributionResponse, distribution);
}
