import { jsonResponse } from "@/services/openapi/json-response";
import { getOnslaughtSeasonHistory } from "@unicum.gg/core/wargaming/wot/players/onslaught-history";
import { isRegion } from "@unicum.gg/wargaming";
import { OnslaughtHistoryResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Onslaught season history
 * @description How an Onslaught season's leaderboard moved while it ran: how many players held a place, and what it cost to hold Legend or Champion, sampled through the season. The game recomputes its board every few minutes and serves only the current instant, keeping no history of its own, so this series exists because we recorded it.
 * @pathParams regionParams
 * @queryParams onslaughtHistoryQuery
 * @response OnslaughtHistoryResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/onslaught/history", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const season =
    new URL(req.url).searchParams.get("season") ?? undefined;

  try {
    const data = await getOnslaughtSeasonHistory(region, season);
    if (!data) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    // The capture writes on its own cadence, so a short cache absorbs a burst of
    // readers without ever hiding a sample for long.
    return jsonResponse(OnslaughtHistoryResponse, data, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (err) {
    console.error(`[api/${region}/players/onslaught/history] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
