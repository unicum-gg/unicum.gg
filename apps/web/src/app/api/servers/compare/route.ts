import { isServerStatsRange, ServerStatsRange } from "@unicum.gg/shared";
import { getServerComparison } from "@/services/servers";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { ServerComparisonResponse } from "./schema.api";

/**
 * Compare regions
 * @description Every region's total population on one timeline, for the requested range. Region-less by nature: comparing EU, NA and Asia is the point, and asking one region for the other two would be a strange shape. Cached for 60s server-side. Dates are ISO 8601 strings.
 * @queryParams serverStatsQuery
 * @response ServerComparisonResponse
 * @openapi
 * @tag Server
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /servers/compare", () => GET__perf(...args));
}
async function GET__perf(req: Request) {
  const requested = new URL(req.url).searchParams.get("range");
  const range =
    requested && isServerStatsRange(requested) ? requested : ServerStatsRange.Day;
  const comparison = await getServerComparison(range);
  return jsonResponse(ServerComparisonResponse, comparison);
}
