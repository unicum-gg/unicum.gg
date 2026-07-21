import { loadPlayerTanks } from "@unicum.gg/core/players/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { PlayerTanksResponse } from "./schema.api";

/**
 * Player tanks
 * @description Per-tank rows for a player: the tank-by-tank breakdown with per-battle averages and WN7/WN8/WNX ratings. This is the heavy list on the player page, so it lives on its own endpoint and is loaded on demand (a deep link to `?section=tanks` server-renders it; otherwise the client fetches it when the Tanks section is first opened). 404 when the player is unknown.
 * @pathParams playerLiveParams
 * @response PlayerTanksResponse
 * @tag Players
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  try {
    const tanks = await loadPlayerTanks(region, decoded);
    if (tanks === null) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerTanksResponse, { tanks });
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/tanks] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
