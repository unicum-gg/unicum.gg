import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import {
  DEFAULT_LIMIT,
  getManeuversBoard,
} from "@/services/maneuvers/leaderboard";
import { ManeuversBoardResponse } from "./schema.api";

/**
 * Maneuvers event boards
 * @description The region's current Maneuvers edition, the recurring Stronghold clan event: its dates and reward cutoffs, the player and clan boards ranked by Fame Points, and what it currently costs to hold a rewarded place. Both boards describe the same instant. Cached ~1 min server-side.
 * @pathParams regionParams
 * @queryParams maneuversQuery
 * @response ManeuversBoardResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maneuvers", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const raw = new URL(req.url).searchParams.get("limit");
  const limit = raw ? Number(raw) : DEFAULT_LIMIT;

  const board = await getManeuversBoard(
    region,
    Number.isFinite(limit) ? limit : DEFAULT_LIMIT,
  );
  return jsonResponse(ManeuversBoardResponse, board);
}
