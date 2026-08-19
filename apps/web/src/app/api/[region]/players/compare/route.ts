import { isRegion } from "@unicum.gg/wargaming";
import { buildWN8Fallback } from "@unicum.gg/shared";
import { loadPlayerInitialData } from "@unicum.gg/core/players/initial-data";
import { tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayersCompareResponse } from "./schema.api";
import { measured } from "@/services/perf";

const MAX_PLAYERS = 4;

/**
 * Compare players
 * @description Inputs for a side-by-side comparison of up to 4 players (`?names=a,b,c`): each player's tracked row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and the WN8/WNX expected-value tables the ratings derive from. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @queryParams compareNamesQuery
 * @response PlayersCompareResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/compare", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const names = (new URL(req.url).searchParams.get("names") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_PLAYERS);
  if (names.length === 0) {
    return Response.json({ error: "missing_names" }, { status: 400 });
  }

  const [encyclopedia, wn8Expected, wnxExpected, ...initials] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      ...names.map((nick) => loadPlayerInitialData(region, { nickname: nick })),
    ]);

  const slots = names.map((requested, i) => {
    const initial = initials[i];
    const renderable = initial.player && initial.latestSnapshot;
    return {
      requested,
      player: initial.player,
      latest: initial.latestSnapshot,
      tanks: renderable
        ? tankSnapshotsToTankStats(initial.latestTankSnapshots)
        : [],
    };
  });

  // The client only ever indexes the reference tables by the tank ids the
  // compared players actually own, so ship just those entries instead of the
  // full ~1200-tank catalogue + expected tables (which are 94% of the payload).
  // The WN8 fallback (per tier+type average, used for tanks missing from the
  // expected table) must be computed from the FULL tables, so precompute it
  // here and send it rather than have the client rebuild it from a trimmed set.
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const ownedIds = new Set<number>();
  for (const slot of slots) {
    for (const t of slot.tanks) ownedIds.add(t.tank_id);
  }
  const pickRecord = <V>(rec: Record<string, V>): Record<string, V> =>
    Object.fromEntries(
      Object.entries(rec).filter(([id]) => ownedIds.has(Number(id))),
    );
  const pickMap = <V>(map: Map<number, V>): Record<string, V> =>
    Object.fromEntries([...map].filter(([id]) => ownedIds.has(id)));

  return jsonResponse(PlayersCompareResponse, {
    slots,
    encyclopedia: pickRecord(encyclopedia),
    wn8Expected: pickMap(wn8Expected),
    wnxExpected: pickMap(wnxExpected),
    wn8Fallback: Object.fromEntries(wn8Fallback),
  });
}
