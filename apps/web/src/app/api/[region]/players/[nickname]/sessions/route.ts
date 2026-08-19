import { loadPlayerSessions } from "@unicum.gg/core/players/sessions";
import { SessionGranularity } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerSessionsResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

function granularityOf(value: string | null): SessionGranularity {
  return Object.values(SessionGranularity).includes(
    value as SessionGranularity,
  )
    ? (value as SessionGranularity)
    : SessionGranularity.Daily;
}

/**
 * Player sessions
 * @description What a player played, session by session: battles, average tier, the vehicles taken out, and the per-battle averages and ratings of that stretch alone. The game keeps no session log and Wargaming exposes none, so each bucket is the difference between two consecutive snapshots of the player's vehicles, attributed to when it was observed. Bucketed by day, week or month; newest first. 404 when the player is unknown.
 * @pathParams playerLiveParams
 * @queryParams playerSessionsQuery
 * @response PlayerSessionsResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/sessions", () => GET__perf(...args));
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
  const granularity = granularityOf(
    new URL(req.url).searchParams.get("granularity"),
  );

  try {
    const sessions = await loadPlayerSessions(region, decoded, granularity);
    if (sessions === null) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(PlayerSessionsResponse, { granularity, sessions });
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/sessions] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
