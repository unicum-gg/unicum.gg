import { isRegion } from "@unicum.gg/wargaming";
import { getClanIdByAddress } from "@unicum.gg/core/clans/address";
import { countClanSupporters } from "@unicum.gg/core/subscription/clan";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClanSupportersResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan supporters
 * @description How many of this clan's current members hold an active monthly pledge to unicum.gg and count it for the clan. A member only ever counts for the clan they are in, and stops counting the day they leave it. 404 when the tag is unknown in this region.
 * @pathParams clanLiveParams
 * @response ClanSupportersResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/supporters", () =>
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
  const clanId = await getClanIdByAddress(region, decodeURIComponent(tag));
  if (clanId === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const supporters = await countClanSupporters(region, clanId);
  return jsonResponse(
    ClanSupportersResponse,
    { supporters },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
