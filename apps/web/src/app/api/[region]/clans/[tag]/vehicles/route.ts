import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion } from "@unicum.gg/core/db/schema";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import { buildClanVehicleRows } from "@unicum.gg/core/clans/vehicles";
import { isRegion } from "@unicum.gg/wargaming/region";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/ratings";

/**
 * Clan vehicles
 * @description Per-tank stats for a clan, aggregated across all members from their most recent tank snapshots: member count, total battles, battle-weighted average damage and XP, win rate, and WN7/WN8/WNX ratings. This is the heavy aggregation on the clan page, so it lives on its own endpoint and is loaded on demand.
 * @pathParams clanLiveParams
 * @response ClanVehiclesResponse
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
  const decoded = decodeURIComponent(tag).toLowerCase();
  const clans = clansByRegion[region];
  const [row] = await db
    .select({ id: clans.id })
    .from(clans)
    .where(eq(clans.tagLower, decoded))
    .limit(1);
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [aggregates, encyclopedia, wn8Expected, wnxExpected] =
      await Promise.all([
        getClanTankAggregates(region, Number(row.id)),
        getVehicleEncyclopedia(region),
        getWN8ExpectedValues(),
        getWNXExpectedValues(),
      ]);
    const vehicles = buildClanVehicleRows(
      aggregates,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    );
    return Response.json({ vehicles });
  } catch (err) {
    console.error(`[api/${region}/clans/${decoded}/vehicles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
