import { isRegion } from "@unicum.gg/wargaming";
import { isStatWindowMode } from "@unicum.gg/shared";
import { loadPlayerModeWindow } from "@unicum.gg/core/players/mode-window";
import { jsonResponse } from "@/services/openapi/json-response";
import { statWindowOf } from "@/services/players/stat-window";
import { PlayerModeStatWindowResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Player mode stats over a custom window
 * @description A mode tab's period column for any window: the last N days (1 to 365) or the player's last N battles in that mode (1 to 10000), for Skirmish, Advances, Grand Battles, Ranked, Rampage and the three Clan Wars tiers. Same counters as the 24h/7d/30d columns under `strongholds` in the player detail, each one the difference between the account now and as it stood when the window began. These modes are read off the account, which Wargaming refreshes at logout, so a battle window starts where a session did and holds the nearest count at or beyond the one asked for. When the window reaches past our history it covers everything since, and says so in `truncated`. Give exactly one of `days` or `battles`, else 400. 404 when the player is unknown.
 * @pathParams playerLiveParams
 * @queryParams playerModeStatWindowQuery
 * @response PlayerModeStatWindowResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/period/mode", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const search = new URL(req.url).searchParams;
  const mode = search.get("mode") ?? "";
  if (!isStatWindowMode(mode)) {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }
  const window = statWindowOf(search);
  if (!window) {
    return Response.json({ error: "invalid_window" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  try {
    const column = await loadPlayerModeWindow(region, decoded, mode, window);
    if (!column) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerModeStatWindowResponse, column, {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/period/mode] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
