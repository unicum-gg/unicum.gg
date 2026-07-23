import { isRegion } from "@unicum.gg/wargaming";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { getTankMomByRegion } from "@unicum.gg/core/mom";
import { getTankMoeByRegion } from "@unicum.gg/core/moe";
import { getResearchPath } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import { getTankModules } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import {
  getTankStats,
  getTopPlayersByTankAllMetrics,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { getMoeHistory, getMomHistory } from "@/services/tanks/marks-history";
import { getTankConfigsCached } from "@/services/tanks/configs";
import { getTankLoadoutCached } from "@/services/tanks/loadout";
import { getTankCrewCached } from "@/services/tanks/crew";
import { getTankFieldModsCached } from "@/services/tanks/field-mods";
import { getTankSkillTreeCached } from "@/services/tanks/skill-tree";
import {
  getCachedTankDetailJson,
  setCachedTankDetailJson,
} from "@unicum.gg/core/wargaming/wot/tanks/detail-cache";
import { jsonResponse } from "@/services/openapi/json-response";
import { TankDetailResponse } from "./schema.api";

const TOP_LIMIT = 25;
const JSON_HEADERS = { "content-type": "application/json" } as const;

/**
 * Tank detail
 * @description Everything the tank page renders in one payload: identity, top players per rating metric (WN7/WN8/WNX), server-average performance, WN8/WNX expected values, combat specifications, current Marks of Excellence/Mastery with their daily history, and the cheapest research path. `slug` in the response is the canonical slug; callers that reached the tank through a legacy numeric id should redirect to it. Dates are ISO 8601 strings.
 * @pathParams tankParams
 * @response TankDetailResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(slug);

  // Tank detail is static between patches / daily-cron data; serve the whole
  // assembled payload from cache so a navigation isn't a fresh 16-source render.
  const cached = await getCachedTankDetailJson(region, decoded);
  if (cached) return new Response(cached, { headers: JSON_HEADERS });

  const tank = await getTankBySlug(region, decoded);
  if (!tank) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const { tankId, meta, slug: canonicalSlug } = tank;

  const [
    topByMetric,
    serverStats,
    wn8Map,
    wnxMap,
    specsMap,
    moeMap,
    momMap,
    researchPath,
    modules,
    configs,
    loadout,
    crew,
    fieldMods,
    skillTree,
    moeHistory,
    momHistory,
  ] = await Promise.all([
    getTopPlayersByTankAllMetrics(region, tankId, TOP_LIMIT),
    getTankStats(region, tankId),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAllTankSpecs(),
    getTankMoeByRegion(region),
    getTankMomByRegion(region),
    getResearchPath(region, tankId),
    getTankModules(region, tankId),
    getTankConfigsCached(region, tankId),
    getTankLoadoutCached(region, tankId),
    getTankCrewCached(region, tankId),
    getTankFieldModsCached(region, tankId),
    getTankSkillTreeCached(region, tankId),
    getMoeHistory(region, tankId),
    getMomHistory(region, tankId),
  ]);

  const payload = {
    tankId,
    slug: canonicalSlug,
    meta,
    topByMetric,
    serverStats,
    wn8Expected: wn8Map.get(tankId) ?? null,
    wnxExpected: wnxMap.get(tankId) ?? null,
    specs: specsMap.get(tankId) ?? null,
    moe: moeMap.get(tankId) ?? null,
    mom: momMap.get(tankId) ?? null,
    researchPath,
    modules,
    configs,
    loadout,
    crew,
    fieldMods,
    skillTree,
    moeHistory,
    momHistory,
  };

  // Response.json serializes identically; stringify once to both cache and
  // return, keeping jsonResponse's dev-only schema-drift check on the miss.
  const json = JSON.stringify(payload);
  void setCachedTankDetailJson(region, decoded, json);
  if (process.env.NODE_ENV !== "production") {
    jsonResponse(TankDetailResponse, payload);
  }
  return new Response(json, { headers: JSON_HEADERS });
}
