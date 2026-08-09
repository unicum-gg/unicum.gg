import {
  loadPlayerAchievements,
  PlayerAchievementsError,
} from "@unicum.gg/core/players/achievements";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerAchievementsResponse } from "./schema.api";

/**
 * Player achievements
 * @description The full Wargaming medal catalogue with the number of times this player earned each one (0 when never), grouped into Wargaming's own sections and ordered the way the in-game cabinet is. Includes retired event medals, flagged as outdated, so the client can offer them as a filter rather than decide for the reader. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @response PlayerAchievementsResponse
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
    const data = await loadPlayerAchievements(region, decoded);
    if (data === PlayerAchievementsError.PlayerUnknown) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerAchievementsResponse, data);
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/achievements] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
