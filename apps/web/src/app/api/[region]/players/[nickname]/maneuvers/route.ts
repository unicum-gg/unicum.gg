import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { getPlayerManeuvers } from "@/services/maneuvers/player";
import { measured } from "@/services/perf";
import { PlayerManeuversResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Player Maneuvers record
 * @description This player's record in Maneuvers, the recurring Stronghold clan event: their place and Fame Points on the edition being played with the day's move, their climb through it, and every edition they held a place on. The game keeps no history of its boards, so all of it comes from our own captures. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @response PlayerManeuversResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/maneuvers", () =>
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
  const data = await getPlayerManeuvers(region, decodeURIComponent(nickname));
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(PlayerManeuversResponse, data, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
