import { isRegion } from "@unicum.gg/wargaming";
import {
  StatWindowUnit,
  isValidStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { loadPlayerStatWindow } from "@unicum.gg/core/players/stat-window";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerStatWindowResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

function windowOf(params: URLSearchParams): StatWindow | null {
  const days = params.get("days");
  const battles = params.get("battles");
  if ((days === null) === (battles === null)) return null;
  const w =
    days !== null
      ? { unit: StatWindowUnit.Days, value: Number(days) }
      : { unit: StatWindowUnit.Battles, value: Number(battles) };
  return isValidStatWindow(w) ? w : null;
}

/**
 * Player stats over a custom window
 * @description The profile's period column for any window: the last N days (1 to 365) or the player's last N battles (1 to 10000). Same counters, average tier, assistance and WN7/WN8/WNX as the 24h/7d/30d columns of the player detail, each one the difference between the player's vehicles now and as they stood when the window began. A battle window can only start where we took a snapshot, so it holds the nearest count at or beyond the one asked for. When the window reaches past our history of the account it covers everything since we first tracked it, and says so in `truncated`. Give exactly one of `days` or `battles`, else 400. 404 when the player is unknown.
 * @pathParams playerLiveParams
 * @queryParams playerStatWindowQuery
 * @response PlayerStatWindowResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/period", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const window = windowOf(new URL(req.url).searchParams);
  if (!window) {
    return Response.json({ error: "invalid_window" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  try {
    const column = await loadPlayerStatWindow(region, decoded, window);
    if (!column) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerStatWindowResponse, column, {
      // The profile's own freshness: its payload is held for a minute too.
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/period] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
