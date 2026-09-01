import { isRegion } from "@unicum.gg/wargaming";
import { getClanTournaments } from "@unicum.gg/core/tournaments/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClanTournamentsResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan tournaments
 * @description Every Wargaming tournament this clan has entered, newest first. The link does not exist upstream: the tournament system knows teams and account ids but never clans, so a team is tied to a clan by matching its roster against clan membership on the day it was played. 404 when the tag is unknown in this region; an empty list means the clan has simply never entered one.
 * @pathParams clanLiveParams
 * @response ClanTournamentsResponse
 * @tag Tournaments
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/tournaments", () =>
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

  const data = await getClanTournaments(region, decodeURIComponent(tag));
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return jsonResponse(ClanTournamentsResponse, data, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
