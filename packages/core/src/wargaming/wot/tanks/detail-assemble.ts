import { withPlayerBadges } from "./top-player-badges";
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
import { TankClient, type VehicleMode } from "@unicum.gg/shared";
import {
  fetchMomHistoryFromPoliroid,
  type MomHistoryPoint,
} from "@unicum.gg/core/mom/poliroid";
import {
  fetchMoeHistoryFromPoliroid,
  type MoeHistoryPoint,
} from "@unicum.gg/core/moe/poliroid";
import { getTestVersion } from "@unicum.gg/core/wargaming/wot/tanks/test-changes";
import { WotSrcBranch, type Region } from "@unicum.gg/wargaming";
import { getTankRatingHeadline } from "@unicum.gg/core/tanks/ratings-read";

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
 *
 * `client` picks which game client the characteristics are read from. Only the
 * vehicle's own data moves with it (its modules, ammunition, crew, field mods
 * and the specs derived from them): server stats, marks and top players stay on
 * the region's live client, because a test server has no players to measure.
 */
export async function assembleTankDetail(
  region: Region,
  slug: string,
  client: TankClient = TankClient.Live,
) {
  const tank = await getTankBySlug(region, slug);
  if (!tank) return null;
  const { tankId, meta, slug: canonicalSlug } = tank;
  // Which client the characteristics are read from. An unreleased vehicle only
  // exists on the test one, so it has no say in the matter; a released one is
  // read from the test client when the caller asks for it, which is what lets a
  // player configure a tank the way the next update will ship it.
  const onTest = meta.isCommonTest || client === TankClient.CommonTest;
  const branch = onTest ? WotSrcBranch.CT : undefined;

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
    testVersion,
    rating,
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
    safe(() => getTankConfigs(region, tankId, undefined, branch), [] as TankConfig[]),
    safe(() => getTankLoadout(region, tankId, branch), null),
    safe(() => getTankCrew(region, tankId, branch), null),
    safe(() => getTankFieldMods(region, tankId, branch), null),
    safe(() => getTankSkillTree(region, tankId, branch), null),
    safe(() => getTankVehicleModes(region, tankId, branch), [] as VehicleMode[]),
    safe(() => fetchMoeHistoryFromPoliroid(region, tankId), [] as MoeHistoryPoint[]),
    safe(() => fetchMomHistoryFromPoliroid(region, tankId), [] as MomHistoryPoint[]),
    safe(() => getTankHasHistory(tankId), false),
    // Whether a Common Test rebalances this tank, and which build does. Drives
    // the switch that offers the test client's numbers, so it is read on every
    // tank rather than only on the tab that lists the changes.
    safe(() => getTestVersion(tankId), null),
    // Three numbers for the hero badge and the page's Product markup. Folded in
    // here rather than fetched by the layout, which would have been a second
    // SSR self-fetch on every tab of every vehicle.
    safe(() => getTankRatingHeadline(tankId), {
      overall: null,
      votes: 0,
      reviewCount: 0,
    }),
  ]);

  // The crests, folded into the payload rather than attached per request: this
  // whole assembly is cached and served back as a raw string, so attaching them
  // on the way out would mean parsing and re-serialising a large JSON on every
  // view. The cost is staleness bounded by the cache, which a badge tolerates
  // (a new supporter's mark appears a few hours late) and a leaderboard row
  // without any crest at all does not, since it contradicts every other list on
  // the site. `SHAPE_VERSION` is bumped alongside, or the entries already in
  // Redis would come back missing these fields.
  const topByMetricWithBadges = await withPlayerBadges(region, topByMetric);

  return {
    tankId,
    slug: canonicalSlug,
    meta,
    topByMetric: topByMetricWithBadges,
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
    // Which client these characteristics came from, and the test build that is
    // available for this tank (null when none is). The page needs both: one to
    // label what it is showing, the other to know whether to offer the switch.
    client: onTest ? TankClient.CommonTest : TankClient.Live,
    testVersion,
    rating,
  };
}
