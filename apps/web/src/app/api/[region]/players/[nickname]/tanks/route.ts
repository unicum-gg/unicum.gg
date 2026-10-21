import { loadPlayerTanks } from "@unicum.gg/core/players/tanks-list";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { tankBattleMode } from "@unicum.gg/shared";
import { PlayerTanksResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Player tanks
 * @description Per-tank rows for a player: the tank-by-tank breakdown with per-battle averages and WN7/WN8/WNX ratings. This is the heavy list on the player page, so it lives on its own endpoint and is loaded on demand (a deep link to `?section=tanks` server-renders it; otherwise the client fetches it when the Tanks section is first opened). Pass `mode` to get the same rows for one battle mode instead of the vehicle's whole record, narrowed to the vehicles the player actually took into it. 404 when the player is unknown.
 * @pathParams playerLiveParams
 * @queryParams playerTanksQuery
 * @response PlayerTanksResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/tanks", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);
  // Unknown in, overall out: a mode Wargaming retires must not turn a
  // bookmarked URL into a 400, and the overall list is the honest fallback.
  const mode = tankBattleMode(new URL(req.url).searchParams.get("mode"));

  try {
    const data = await loadPlayerTanks(region, decoded, mode);
    if (data === null) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerTanksResponse, data);
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/tanks] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
