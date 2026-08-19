import { isRegion, type Region } from "@unicum.gg/wargaming";
import { buildWN8Fallback } from "@unicum.gg/shared";
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
import { measured } from "@/services/perf";

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
 * @queryParams compareTagsQuery
 * @response ClansCompareResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/compare", () => GET__perf(...args));
}
async function GET__perf(
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

  const slots = tags.map((requested, i) => ({ requested, ...clanData[i] }));

  // Ship only the reference-table entries for the tanks the compared clans
  // actually field (their per-tank aggregates), instead of the full ~1200-tank
  // catalogue + expected tables. The WN8 fallback (per tier+type average for
  // tanks missing from the expected table) is computed from the FULL tables and
  // sent, so the trimmed tables never change any rating. Mirrors players/compare.
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const ownedIds = new Set<number>();
  for (const slot of slots) {
    for (const a of slot.tankAggregates) ownedIds.add(a.tankId);
  }
  const pickRecord = <V>(rec: Record<string, V>): Record<string, V> =>
    Object.fromEntries(
      Object.entries(rec).filter(([id]) => ownedIds.has(Number(id))),
    );
  const pickMap = <V>(map: Map<number, V>): Record<string, V> =>
    Object.fromEntries([...map].filter(([id]) => ownedIds.has(id)));

  return jsonResponse(ClansCompareResponse, {
    slots,
    encyclopedia: pickRecord(encyclopedia),
    wn8Expected: pickMap(wn8Expected),
    wnxExpected: pickMap(wnxExpected),
    wn8Fallback: Object.fromEntries(wn8Fallback),
  });
}
