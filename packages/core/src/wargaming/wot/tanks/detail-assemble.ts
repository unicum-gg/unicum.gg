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
import {
  getTankConfigs,
  type TankConfig,
} from "@unicum.gg/core/wargaming/wot/tanks/configs";
import { getTankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import { getTankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import { getTankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import { getTankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import { getTankHasHistory } from "@unicum.gg/core/wargaming/wot/tanks/spec-history";
import { getTankVehicleModes } from "@unicum.gg/core/wargaming/wot/tanks/vehicle-modes";
import type { VehicleMode } from "@unicum.gg/shared";
import {
  fetchMomHistoryFromPoliroid,
  type MomHistoryPoint,
} from "@unicum.gg/core/mom/poliroid";
import {
  fetchMoeHistoryFromPoliroid,
  type MoeHistoryPoint,
} from "@unicum.gg/core/moe/poliroid";
import type { Region } from "@unicum.gg/wargaming";

const TOP_LIMIT = 25;

// Fails-open boundary: the five wot-src sections (configs/crew/loadout/field-mods/
// skill-tree) and the two Poliroid mark histories each hide gracefully on a
// provider blip rather than failing the whole payload (mirrors the old
// `services/tanks/*Cached` wrappers). The heavy wot-src fetch+parse is already
// Redis-cached inside each core fn, so this only adds the fallback.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Assemble the full tank-detail payload from its ~16 sources. Shared by the
 * `/{region}/tanks/{slug}/detail` route (request path) and the worker's
 * `tank-warm` cron (proactive daily refresh), so both produce the exact same
 * shape with no drift. Returns `null` when the slug resolves to no tank (404);
 * `slug` in the payload is the canonical slug (callers redirect legacy ids to it).
 */
export async function assembleTankDetail(region: Region, slug: string) {
  const tank = await getTankBySlug(region, slug);
  if (!tank) return null;
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
    modes,
    moeHistory,
    momHistory,
    hasHistory,
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
    safe(() => getTankConfigs(region, tankId), [] as TankConfig[]),
    safe(() => getTankLoadout(region, tankId), null),
    safe(() => getTankCrew(region, tankId), null),
    safe(() => getTankFieldMods(region, tankId), null),
    safe(() => getTankSkillTree(region, tankId), null),
    safe(() => getTankVehicleModes(region, tankId), [] as VehicleMode[]),
    safe(() => fetchMoeHistoryFromPoliroid(region, tankId), [] as MoeHistoryPoint[]),
    safe(() => fetchMomHistoryFromPoliroid(region, tankId), [] as MomHistoryPoint[]),
    safe(() => getTankHasHistory(tankId), false),
  ]);

  return {
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
    modes,
    moeHistory,
    momHistory,
    hasHistory,
  };
}
