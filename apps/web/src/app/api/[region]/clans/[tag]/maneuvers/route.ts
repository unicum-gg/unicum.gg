import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { getClanManeuvers } from "@/services/maneuvers/clan";
import { attachPlayerCrests } from "@/services/players/attach-badges";
import { measured } from "@/services/perf";
import { ClanManeuversResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Clan Maneuvers record
 * @description This clan's record in Maneuvers, the recurring Stronghold clan event: its place and Fame Points on the edition being played with the day's move, its climb through it, every edition it held a place on, and which of its players sit on the player board. The game keeps no history of its boards, so all of it comes from our own captures. 404 when the tag is unknown in this region.
 * @pathParams clanLiveParams
 * @response ClanManeuversResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/maneuvers", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const data = await getClanManeuvers(region, decodeURIComponent(tag));
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  // The members' crests, attached here like every other list producer, so a
  // name reads the same as on the board.
  const members = await attachPlayerCrests(region, data.members);
  return jsonResponse(
    ClanManeuversResponse,
    { ...data, members },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
