import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewTankSpec, type TankSpec, tankSpecs } from "@unicum.gg/shared";
import {
  BRANCH_BY_REGION,
  compareBuildVersions,
  Region,
  WotSrcBranch,
} from "@unicum.gg/wargaming";
import { clearTestChanges, recordTestChanges } from "./test-changes";
import { wg } from "../../client";
import { recordSpecChanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-history";

// Module-level cache for the global tank-specs catalogue. `tank_specs` is a
// static-between-patches table (refreshed once a day by vehicles-cron), yet
// `getAllTankSpecs` sits on the player-detail render path and was measured as
// the single busiest read in prod: ~104k full-table scans of all ~1229 rows in
// under 7h (≈10% of all Postgres exec time). A plain process-lifetime cache with
// in-flight dedup collapses that to one scan per TTL per process. Mirrors the
// `getVehicleEncyclopedia` pattern (a Map, not `unstable_cache`, so cron-driven
// callers without an IncrementalCache context don't throw). `refreshTankSpecs`
// busts it so a daily catalogue refresh is visible at once instead of after TTL.
const SPECS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let specsCache: { data: Map<number, TankSpec>; expiresAt: number } | null = null;
let specsInFlight: Promise<Map<number, TankSpec>> | null = null;

async function loadAllTankSpecs(): Promise<Map<number, TankSpec>> {
  const rows = await db.select().from(tankSpecs);
  return new Map(rows.map((r) => [r.tankId, r]));
}

/** Every tank's in-game specs (global, top config), keyed by tank id. Powers
 * the /tanks Specifications table. Cached for the process lifetime (see above);
 * concurrent callers share the in-flight scan. */
export function getAllTankSpecs(): Promise<Map<number, TankSpec>> {
  if (specsCache && specsCache.expiresAt > Date.now()) {
    return Promise.resolve(specsCache.data);
  }
  if (specsInFlight) return specsInFlight;
  specsInFlight = loadAllTankSpecs()
    .then((data) => {
      specsCache = { data, expiresAt: Date.now() + SPECS_CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      specsInFlight = null;
    });
  return specsInFlight;
}

/** Drop the cached catalogue so the next read reloads (called after a refresh). */
export function invalidateTankSpecsCache(): void {
  specsCache = null;
}

const SPEC_INSERT_CHUNK = 500;

type ResearchNode = {
  // The tank's tier (WG encyclopedia `tier`), used to key the per-tier free-XP
  // breakdown. Null when WG omits it.
  tier: number | null;
  // Cheapest XP to unlock this tank from a direct parent (null = tier-1/premium).
  researchXp: number | null;
  // Per-parent unlock XP (`prices_xp`), so path costs use the actual edge.
  pricesXp: Map<number, number>;
  previousTanks: number[];
  nextTanks: number[];
  // XP spent on THIS tank's modules before each next tank can be researched:
  // child tank id → cheapest prerequisite module chain (0 = no module gate).
  moduleUnlockXp: Map<number, number>;
  description: string | null;
};

type ModuleTreeNode = {
  module_id: number;
  is_default: boolean;
  price_xp: number;
  next_modules: number[] | null;
  next_tanks: number[] | null;
};

/**
 * XP that must be sunk into a vehicle's modules before each of its next tanks
 * unlocks: the researchable vehicles hang off specific modules (`next_tanks`),
 * and researching such a module first means paying the cheapest prerequisite
 * chain from a stock module (e.g. GSOR 1006/7: 105 mm gun 51k, then turret
 * 24.6k, before Concept 5's own 225k). Stock modules cost nothing.
 */
function moduleUnlockCosts(
  tree: Record<string, ModuleTreeNode> | null | undefined,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!tree) return out;
  const nodes = Object.values(tree);
  const byId = new Map(nodes.map((n) => [n.module_id, n]));
  const parents = new Map<number, number[]>();
  for (const node of nodes) {
    for (const child of node.next_modules ?? []) {
      parents.set(child, [...(parents.get(child) ?? []), node.module_id]);
    }
  }
  const memo = new Map<number, number>();
  const chainCost = (id: number, visiting: Set<number>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const node = byId.get(id);
    let cost = 0;
    if (node && !node.is_default) {
      const from = parents.get(id) ?? [];
      const cheapestParent = from.length
        ? Math.min(...from.map((p) => chainCost(p, visiting)))
        : 0;
      cost = node.price_xp + cheapestParent;
    }
    visiting.delete(id);
    memo.set(id, cost);
    return cost;
  };
  for (const node of nodes) {
    for (const tank of node.next_tanks ?? []) {
      const cost = chainCost(node.module_id, new Set());
      const prev = out.get(tank);
      out.set(tank, prev === undefined ? cost : Math.min(prev, cost));
    }
  }
  return out;
}

/**
 * The tech-tree research graph from the WG encyclopedia: `prices_xp`
 * (parent tank id → XP cost to unlock this tank) gives the parent edges and
 * the unlock XP, `next_tanks` the child edges. Region-agnostic, so we page
 * through the EU catalogue once. Only the ~1000 tanks WG's public API lists are
 * covered; the rest stay absent.
 */
async function fetchResearchGraph(): Promise<Map<number, ResearchNode>> {
  const out = new Map<number, ResearchNode>();
  for (let pageNo = 1; ; pageNo++) {
    let page: Record<
      string,
      {
        tier: number | null;
        prices_xp: Record<string, number> | null;
        next_tanks: Record<string, number> | null;
        modules_tree: Record<string, ModuleTreeNode> | null;
        description: string | null;
      }
    >;
    try {
      page = await wg.region(Region.EU).api.wot.encyclopedia.vehicles({
        fields: ["tier", "prices_xp", "next_tanks", "modules_tree", "description"],
        limit: 100,
        pageNo,
      });
    } catch (err) {
      // WG throws PAGE_NO_NOT_FOUND once we step past the last page.
      if ((err as { code?: string }).code === "PAGE_NO_NOT_FOUND") break;
      throw err;
    }
    const entries = Object.entries(page);
    if (entries.length === 0) break;
    for (const [id, v] of entries) {
      const previousTanks: number[] = [];
      const pricesXp = new Map<number, number>();
      let researchXp: number | null = null;
      if (v.prices_xp && typeof v.prices_xp === "object") {
        for (const [parentId, xp] of Object.entries(v.prices_xp)) {
          const p = Number(parentId);
          const x = Number(xp);
          if (Number.isFinite(p)) previousTanks.push(p);
          if (Number.isFinite(p) && Number.isFinite(x) && x > 0)
            pricesXp.set(p, x);
          if (Number.isFinite(x) && x > 0)
            researchXp = researchXp === null ? x : Math.min(researchXp, x);
        }
      }
      // `next_tanks` is a { childTankId: xpRequired } map, so the keys are the
      // researchable follow-up tanks.
      const nextTanks =
        v.next_tanks && typeof v.next_tanks === "object"
          ? Object.keys(v.next_tanks)
              .map(Number)
              .filter(Number.isFinite)
          : [];
      out.set(Number(id), {
        tier: Number.isFinite(Number(v.tier)) ? Number(v.tier) : null,
        researchXp,
        pricesXp,
        previousTanks,
        nextTanks,
        moduleUnlockXp: moduleUnlockCosts(v.modules_tree),
        description: v.description || null,
      });
    }
    if (entries.length < 100) break;
  }
  return out;
}

/**
 * Cumulative XP to research a tank from a tier-1 starter, over the cheapest
 * research path where each parent→child edge costs the child's unlock XP for
 * that specific parent (`prices_xp`) PLUS the XP sunk into the parent's
 * prerequisite modules for that child (`moduleUnlockCosts`) — researching a
 * tank in game first means researching the module that carries it.
 * Tier-1/premium tanks (no parents) resolve to 0 — nothing to research — and
 * get stored as null so only genuinely researchable tanks surface a "Free XP
 * from tier 1". Memoized; a `visiting` set guards against any accidental cycle
 * in WG's data.
 */
type FreeXp = {
  // Cumulative XP from a tier-1 starter over the cheapest path.
  total: number;
  // Cumulative XP to reach each ANCESTOR on that same path, keyed by the
  // ancestor's tier (`{ 2: 1200, 3: 4800, ... }`, tiers 1..this-1). Owning a
  // tier-N tank on the path means the free-XP cost is `total - byTier[N]`.
  byTier: Record<number, number>;
};

function computeFreeXp(graph: Map<number, ResearchNode>): Map<number, FreeXp> {
  const memo = new Map<number, number>();
  const bestParent = new Map<number, number | null>();
  const visiting = new Set<number>();

  function total(id: number): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = graph.get(id);
    if (!node || node.previousTanks.length === 0) {
      memo.set(id, 0);
      bestParent.set(id, null);
      return 0;
    }
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = Number.POSITIVE_INFINITY;
    let chosen: number | null = null;
    for (const p of node.previousTanks) {
      const edgeXp = node.pricesXp.get(p) ?? node.researchXp ?? 0;
      const moduleXp = graph.get(p)?.moduleUnlockXp.get(id) ?? 0;
      const cand = total(p) + edgeXp + moduleXp;
      if (cand < best) {
        best = cand;
        chosen = p;
      }
    }
    visiting.delete(id);
    const sum = Number.isFinite(best) ? best : (node.researchXp ?? 0);
    memo.set(id, sum);
    bestParent.set(id, chosen);
    return sum;
  }

  const out = new Map<number, FreeXp>();
  for (const id of graph.keys()) {
    const t = total(id);
    // Walk back up the chosen (cheapest) parents, recording each ancestor's
    // cumulative XP under its tier. A guard breaks any accidental cycle.
    const byTier: Record<number, number> = {};
    const seen = new Set<number>();
    for (
      let cur = bestParent.get(id) ?? null;
      cur != null && !seen.has(cur);
      cur = bestParent.get(cur) ?? null
    ) {
      seen.add(cur);
      const tier = graph.get(cur)?.tier;
      if (tier != null) byTier[tier] = memo.get(cur) ?? 0;
    }
    out.set(id, { total: t, byTier });
  }
  return out;
}

/**
 * Parse the whole vehicle catalogue's top-config specifications from the
 * IzeBerg/wot-src game client mirror and upsert into the global `tank_specs`
 * table. Specs are region-agnostic (WG balances vehicles identically across
 * servers), so we fetch once from the EU branch. Called by the vehicles cron.
 * Returns the number of tanks written.
 */
export async function refreshTankSpecs(): Promise<number> {
  const eu = wg.region(Region.EU);
  const [live, test, liveVersion, testVersion, graph] = await Promise.all([
    eu.source.specs.catalog(),
    // Unreleased vehicles have specifications on the test branch and nowhere
    // else, and those are the whole point of showing them: a player wants to
    // read the gun and the armour before the tank ships. Failing to read the
    // branch (no test running) simply leaves the live catalogue as it was.
    eu.source.specs.catalog(WotSrcBranch.CT).catch(() => []),
    eu.source.specs.branchVersion(BRANCH_BY_REGION[Region.EU]).catch(() => null),
    eu.source.specs.branchVersion(WotSrcBranch.CT).catch(() => null),
    fetchResearchGraph(),
  ]);

  // A test branch is only a test build while it is ahead of the live one. It is
  // not always: the mirror's CT branch has been left sitting on a finished test,
  // matching live exactly, and read blindly that inverts everything downstream.
  // The diff would report what the last update shipped as pending changes with
  // the buff and nerf arrows backwards, and vehicles that update introduced
  // would re-enter the catalogue as unreleased. Proven ahead or not used.
  const testIsAhead =
    liveVersion !== null &&
    testVersion !== null &&
    compareBuildVersions(testVersion, liveVersion) > 0;
  if (test.length > 0 && !testIsAhead) {
    console.warn(
      `[tank-specs] ignoring the test branch: ${testVersion ?? "unknown"} is not ahead of live ${liveVersion ?? "unknown"}`,
    );
  }
  const usableTest = testIsAhead ? test : [];

  const known = new Set(live.map((v) => v.tankId));
  const testOnly = usableTest.filter((v) => !known.has(v.tankId));
  const catalog = [...live, ...testOnly];
  const commonTest = new Set(testOnly.map((v) => v.tankId));

  // What the test build changes about vehicles that already exist. Fails soft:
  // the rebalance list is a bonus, the catalogue is what the site runs on.
  try {
    if (usableTest.length > 0) {
      const n = await recordTestChanges(live, usableTest, testVersion ?? "unknown");
      console.log(`[tank-specs] common test ${testVersion}: ${n} rebalanced fields`);
    } else if (test.length > 0) {
      // The branch was readable and is not ahead, so whatever it used to say is
      // pending has shipped or was never real. An unreadable branch reaches
      // neither arm and leaves the table as it was.
      await clearTestChanges();
    }
  } catch (err) {
    console.warn("[tank-specs] test-change diff failed:", err);
  }
  const freeXp = computeFreeXp(graph);
  const rows: NewTankSpec[] = catalog.map(
    ({ tag: _tag, shellStats: _ss, mechanics: _mech, ...spec }) => {
    const node = graph.get(spec.tankId);
    const fx = freeXp.get(spec.tankId);
    const total = fx?.total ?? 0;
    return {
      ...spec,
      researchXp: node?.researchXp ?? null,
      previousTanks: node?.previousTanks.length ? node.previousTanks : null,
      nextTanks: node?.nextTanks.length ? node.nextTanks : null,
      totalFreeXp: total > 0 ? total : null,
      freeXpByTier:
        total > 0 && fx && Object.keys(fx.byTier).length > 0
          ? fx.byTier
          : null,
      description: node?.description ?? null,
      updatedAt: new Date(),
    };
  });
  if (rows.length === 0) return 0;

  // Refresh every column from the incoming row on conflict. Built dynamically
  // so the ~45 spec columns don't have to be listed by hand.
  const cols = getTableColumns(tankSpecs);
  const set = Object.fromEntries(
    Object.entries(cols)
      .filter(([, c]) => c.name !== "tank_id")
      .map(([prop, c]) => [prop, sql`excluded.${sql.identifier(c.name)}`]),
  );

  for (let i = 0; i < rows.length; i += SPEC_INSERT_CHUNK) {
    await db
      .insert(tankSpecs)
      .values(rows.slice(i, i + SPEC_INSERT_CHUNK))
      .onConflictDoUpdate({ target: tankSpecs.tankId, set });
  }
  // Fresh catalogue written: drop the cache so this process serves it at once
  // (other processes pick it up within the TTL).
  invalidateTankSpecsCache();

  // Record what changed since the last game version (the tank changes history),
  // from the same rows just written. Fails soft: a history hiccup must not break
  // the daily catalogue refresh, which is the source the whole site reads.
  try {
    // Pass the catalog (not the DB rows): it carries the `mechanics` ability
    // params the tank_specs table has no column for, so the history tracks them.
    const { version, snapshots, changes } = await recordSpecChanges(catalog, commonTest);
    if (changes > 0 || snapshots > 0) {
      console.log(
        `[tank-specs] history ${version}: ${changes} changes, ${snapshots} snapshots`,
      );
    }
  } catch (err) {
    console.error("[tank-specs] failed to record spec changes:", err);
  }

  return rows.length;
}
