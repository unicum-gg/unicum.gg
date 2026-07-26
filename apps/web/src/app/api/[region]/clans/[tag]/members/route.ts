import { loadClanDetailByTag } from "@/services/clans/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanMembersResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Clan members
 * @description The clan's members with cached WN7/WN8/WNX ratings (overall and 30-day) and per-period aggregate stats. 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanMembersResponse
 * @tag Clans
 * @openapi
 */
export async function GET(
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
  const badges = await resolvePlayerBadges(
    region,
    detail.members.map((m) => m.accountId),
  );
  const members = detail.members.map((m) => {
    const b = badges.get(m.accountId);
    return {
      ...m,
      isVerified: b?.verified ?? false,
      isSupporter: b?.supporter ?? false,
      twitchLogin: b?.twitchLogin ?? null,
    };
  });
  return jsonResponse(ClanMembersResponse, { members });
}
