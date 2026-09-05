import { isRegion } from "@unicum.gg/wargaming";
import { getPlayerOnslaught } from "@unicum.gg/core/wargaming/wot/players/onslaught-history";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerOnslaughtResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Player Onslaught record
 * @description This player's Onslaught (Competitive 7) record: every season they held a place on the leaderboard, and how they climbed through the most recent one. Only players who reach Champion enter the board, so an empty record means unranked rather than missing. The game keeps no history of its board, so the climb comes from our own samples. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @response PlayerOnslaughtResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/onslaught", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  try {
    const data = await getPlayerOnslaught(region, decodeURIComponent(nickname));
    if (!data) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return jsonResponse(
      PlayerOnslaughtResponse,
      {
        account_id: data.accountId,
        nickname: data.nickname,
        standings: data.standings,
        lastRecalculationTs: data.lastRecalculationTs,
        history: data.history,
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  } catch (err) {
    console.error(`[api/${region}/players/${nickname}/onslaught] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
