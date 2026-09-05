import { isServerStatsRange, ServerStatsRange } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { getServerStats } from "@/services/servers";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { ServerStatsResponse } from "./schema.api";

/**
 * Server population
 * @description The region's recorded cluster population over the requested range, with each cluster's own peak and mean, the region's records, and the average population per weekday and hour (UTC) over the trailing four weeks. Wargaming publishes population as an instant and keeps no history, so this series only goes back to when the sampling started. Cached for 60s server-side. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @queryParams serverStatsQuery
 * @response ServerStatsResponse
 * @openapi
 * @tag Server
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/server/stats", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const requested = new URL(req.url).searchParams.get("range");
  // An unknown range answers on the default rather than 400: the parameter
  // names a window, and no window a caller could ask for makes the region's
  // population an error.
  const range =
    requested && isServerStatsRange(requested) ? requested : ServerStatsRange.Day;

  const stats = await getServerStats(region, range);
  return jsonResponse(ServerStatsResponse, stats);
}
