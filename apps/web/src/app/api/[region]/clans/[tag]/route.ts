import { eq } from "drizzle-orm";
import { computeClanRatings, clansByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { getClanNameHistory } from "@unicum.gg/core/clans/name-history";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanOverviewResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Clan overview
 * @description The clan's profile and its battle-weighted aggregate ratings (lifetime and 30-day WN7/WN8/WNX plus the average win rate). The heavy per-category data lives on the dedicated sub-endpoints: `/members`, `/previous-clans`, `/activity`, `/stronghold`, `/clan-wars` and `/vehicles`. 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanOverviewResponse
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

  const clans = clansByRegion[region];
  const [cached, nameHistory, countRow] = await Promise.all([
    getClanMembersCached(region, clanCached.info.id).catch(() => null),
    getClanNameHistory(region, clanCached.info.id),
    db
      .select({ vehiclesCount: clans.vehiclesCount })
      .from(clans)
      .where(eq(clans.id, clanCached.info.id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
  ]);
  const ratings = computeClanRatings(cached?.members ?? []);
  return jsonResponse(ClanOverviewResponse, {
    clan: clanCached.info,
    ratings,
    nameHistory,
    vehiclesCount: countRow?.vehiclesCount ?? null,
  });
}
