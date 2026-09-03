import { isRegion } from "@unicum.gg/wargaming";
import { getPlayerTournaments } from "@unicum.gg/core/tournaments/read";
import { attachPlayerCrests } from "@/services/players/attach-badges";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerTournamentsResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Player tournaments
 * @description Every Wargaming tournament this player has entered, newest first, with the team they played for and how far it got. Wargaming publishes tournaments from the tournament's side only, never the player's, so this record exists nowhere else. 404 when the nickname is unknown in this region; an empty list means the player has simply never entered one.
 * @pathParams playerLiveParams
 * @response PlayerTournamentsResponse
 * @tag Tournaments
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/tournaments", () =>
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
  const decoded = decodeURIComponent(nickname);

  const data = await getPlayerTournaments(region, decoded);
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  // The auth-backed crests, attached here rather than in the loader, so the
  // read stays free of auth concerns like every other list producer. The
  // winner's crest already rides the query: it is denormalised on the player
  // row, while these three live in the auth and streamer tables.
  const teammates = await attachPlayerCrests(region, data.teammates);
  return jsonResponse(PlayerTournamentsResponse, { ...data, teammates }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
