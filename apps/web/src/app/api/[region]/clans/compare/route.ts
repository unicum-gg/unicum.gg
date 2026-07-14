import { isRegion, type Region } from "@unicum.gg/wargaming";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClansCompareResponse } from "./schema.api";

const MAX_CLANS = 4;

async function loadClanForCompare(region: Region, tag: string) {
  const cached = await getClanByTagCached(region, tag);
  if (!cached) {
    return { clan: null, members: [], tankAggregates: [] };
  }
  const [membersCached, tankAggregates] = await Promise.all([
    getClanMembersCached(region, cached.info.id),
    getClanTankAggregates(region, cached.info.id),
  ]);
  return {
    clan: cached.info,
    members: membersCached.members,
    tankAggregates,
  };
}

/**
 * Compare clans
 * @description Inputs for a side-by-side comparison of up to 4 clans (`?tags=a,b,c`): each clan's profile, rated members and per-tank aggregates, plus the vehicle catalogue and the WN8/WNX expected-value tables. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response ClansCompareResponse
 * @tag Clans
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
  const tags = (new URL(req.url).searchParams.get("tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_CLANS);
  if (tags.length === 0) {
    return Response.json({ error: "missing_tags" }, { status: 400 });
  }

  const [encyclopedia, wn8Expected, wnxExpected, ...clanData] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      ...tags.map((tag) => loadClanForCompare(region, tag)),
    ]);

  return jsonResponse(ClansCompareResponse, {
    slots: tags.map((requested, i) => ({ requested, ...clanData[i] })),
    encyclopedia,
    wn8Expected: Object.fromEntries(wn8Expected),
    wnxExpected: Object.fromEntries(wnxExpected),
  });
}
