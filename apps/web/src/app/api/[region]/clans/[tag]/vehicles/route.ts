import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion, buildClanVehicleRows } from "@unicum.gg/shared";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanVehiclesResponse } from "./schema.api";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { measured } from "@/services/perf";

/**
 * Clan vehicles
 * @description Per-tank stats for a clan, aggregated across all members from their most recent tank snapshots: member count, total battles, battle-weighted average damage and XP, win rate, and WN7/WN8/WNX ratings. This is the heavy aggregation on the clan page, so it lives on its own endpoint and is loaded on demand.
 * @pathParams clanLiveParams
 * @response ClanVehiclesResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/vehicles", () => GET__perf(...args));
}
async function GET__perf(
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
    // Materialize the count so the clan page shows "Tanks (N)" without re-running
    // this aggregation. After the response, so it never delays it.
    after(() =>
      db
        .update(clansByRegion[region])
        .set({ vehiclesCount: vehicles.length })
        .where(eq(clansByRegion[region].id, Number(row.id)))
        .catch(() => {}),
    );
    return jsonResponse(ClanVehiclesResponse, { vehicles });
  } catch (err) {
    console.error(`[api/${region}/clans/${decoded}/vehicles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
