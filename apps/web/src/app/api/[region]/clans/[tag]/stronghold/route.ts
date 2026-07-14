import { clanStrongholdView } from "@unicum.gg/core/clans/snapshot-stats";
import { loadClanDetailByTag } from "@/services/clans/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanStrongholdResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Clan stronghold stats
 * @description The clan's Stronghold Elo and skirmish/advances stats per tier: `latest` is the current snapshot; each entry in `periods` is the change vs the snapshot 24h/7d/30d ago (null when there's no comparison point). 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanStrongholdResponse
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
  return jsonResponse(
    ClanStrongholdResponse,
    clanStrongholdView(detail.snapshotLatest, detail.snapshotPeriods),
  );
}
