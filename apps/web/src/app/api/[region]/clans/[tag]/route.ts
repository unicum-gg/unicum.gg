import { loadClanDetail } from "@/services/clans/detail";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming/region";
import { ClanDetailResponse } from "./schema.api";

/**
 * Clan detail
 * @description Full clan detail for a region: profile, members with cached WN7/WN8/WNX ratings, the clans members previously belonged to, recent join/leave/role-change activity, and the latest stronghold/global-map snapshot plus 24h/7d/30d comparison points. Dates are ISO 8601 strings.
 * @pathParams clanLiveParams
 * @response ClanDetailResponse
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
  const decoded = decodeURIComponent(tag);

  const clanCached = await getClanByTagCached(region, decoded);
  if (!clanCached) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // Dates serialize to ISO strings here and are revived client-side by
    // parsing with the shared `ClanDetailResponse` schema (z.coerce.date).
    const data = await loadClanDetail(region, clanCached.info);
    return jsonResponse(ClanDetailResponse, data);
  } catch (err) {
    console.error(`[api/${region}/clans/${decoded}] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
