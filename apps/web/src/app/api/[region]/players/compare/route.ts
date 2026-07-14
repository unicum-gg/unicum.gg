import { isRegion } from "@unicum.gg/wargaming";
import { loadPlayerInitialData } from "@unicum.gg/core/players/initial-data";
import { tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayersCompareResponse } from "./schema.api";

const MAX_PLAYERS = 4;

/**
 * Compare players
 * @description Inputs for a side-by-side comparison of up to 4 players (`?names=a,b,c`): each player's tracked row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and the WN8/WNX expected-value tables the ratings derive from. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response PlayersCompareResponse
 * @tag Players
 * @openapi
 */
export async function GET(
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

  return jsonResponse(PlayersCompareResponse, {
    slots: names.map((requested, i) => {
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
    }),
    encyclopedia,
    wn8Expected: Object.fromEntries(wn8Expected),
    wnxExpected: Object.fromEntries(wnxExpected),
  });
}
