import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { getManeuversHistory } from "@/services/maneuvers/history";
import { ManeuversHistoryResponse } from "./schema.api";

/**
 * Maneuvers edition history
 * @description How a Maneuvers edition's boards moved while it ran: what it cost to hold a vehicle place on the player board and a gold place on the clan board, and how many held a place, capture by capture. The game serves only the current instant and keeps no history, so this series exists because we recorded it.
 * @pathParams regionParams
 * @queryParams maneuversHistoryQuery
 * @response ManeuversHistoryResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maneuvers/history", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const edition = new URL(req.url).searchParams.get("edition") || null;
  const data = await getManeuversHistory(region, edition);
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(ManeuversHistoryResponse, data, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
