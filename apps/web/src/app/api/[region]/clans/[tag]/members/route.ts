import { loadClanDetailByTag } from "@/services/clans/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { attachPlayerCrests } from "@/services/players/attach-badges";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanMembersResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan members
 * @description The clan's members with cached WN7/WN8/WNX ratings (overall and 30-day) and per-period aggregate stats. 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanMembersResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/members", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const detail = await loadClanDetailByTag(region, decodeURIComponent(tag));
  if (!detail) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const members = await attachPlayerCrests(region, detail.members);
  return jsonResponse(ClanMembersResponse, { members });
}
