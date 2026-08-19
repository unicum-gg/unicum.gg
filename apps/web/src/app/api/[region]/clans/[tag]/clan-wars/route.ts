import { clanGlobalMapView } from "@unicum.gg/shared";
import { loadClanDetailByTag } from "@/services/clans/detail";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanWarsResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan wars stats
 * @description The clan's Global Map (Clan Wars) Elo, battles, wins and provinces per tier: `latest` is the current snapshot; each entry in `periods` is the change vs the snapshot 24h/7d/30d ago (null when there's no comparison point). 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanWarsResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/clan-wars", () => GET__perf(...args));
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
  return jsonResponse(
    ClanWarsResponse,
    clanGlobalMapView(detail.snapshotLatest, detail.snapshotPeriods),
  );
}
