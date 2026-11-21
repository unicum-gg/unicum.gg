import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  buildClanVehicleRows,
  clanVehicleColumns,
} from "@unicum.gg/shared";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import { getClanIdByAddress } from "@unicum.gg/core/clans/address";
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
  return measured("GET /{region}/clans/{tag}/vehicles", () =>
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

  try {
    const [aggregates, encyclopedia, wn8Expected, wnxExpected] =
      await Promise.all([
        getClanTankAggregates(region, clanId),
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
        .where(eq(clansByRegion[region].id, clanId))
        .catch(() => {}),
    );
    // Transposed on the way out: the aggregation and the ratings are computed
    // here, and one array per field is how the rows cross the wire (see
    // `clanVehicleColumns`, which measured 2.76x on a 974-vehicle clan).
    return jsonResponse(ClanVehiclesResponse, {
      vehicles: clanVehicleColumns(vehicles),
    });
  } catch (err) {
    console.error(`[api/${region}/clans/${tag}/vehicles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
