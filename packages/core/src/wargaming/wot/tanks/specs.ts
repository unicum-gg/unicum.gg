import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewTankSpec, type TankSpec, tankSpecs } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

/** Every tank's in-game specs (global, top config), keyed by tank id. Powers
 * the /tanks Specifications table. */
export async function getAllTankSpecs(): Promise<Map<number, TankSpec>> {
  const rows = await db.select().from(tankSpecs);
  return new Map(rows.map((r) => [r.tankId, r]));
}

const SPEC_INSERT_CHUNK = 500;

type ResearchNode = {
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
        prices_xp: Record<string, number> | null;
        next_tanks: Record<string, number> | null;
        modules_tree: Record<string, ModuleTreeNode> | null;
        description: string | null;
      }
    >;
    try {
      page = await wg.region(Region.EU).api.wot.encyclopedia.vehicles({
        fields: ["prices_xp", "next_tanks", "modules_tree", "description"],
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
function computeTotalFreeXp(
  graph: Map<number, ResearchNode>,
): Map<number, number> {
  const memo = new Map<number, number>();
  const visiting = new Set<number>();

  function total(id: number): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = graph.get(id);
    if (!node || node.previousTanks.length === 0) return 0;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = Number.POSITIVE_INFINITY;
    for (const p of node.previousTanks) {
      const edgeXp = node.pricesXp.get(p) ?? node.researchXp ?? 0;
      const moduleXp = graph.get(p)?.moduleUnlockXp.get(id) ?? 0;
      best = Math.min(best, total(p) + edgeXp + moduleXp);
    }
    visiting.delete(id);
    const sum = Number.isFinite(best) ? best : (node.researchXp ?? 0);
    memo.set(id, sum);
    return sum;
  }

  const out = new Map<number, number>();
  for (const id of graph.keys()) out.set(id, total(id));
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
  const [catalog, graph] = await Promise.all([
    wg.region(Region.EU).source.specs.catalog(),
    fetchResearchGraph(),
  ]);
  const totalFreeXp = computeTotalFreeXp(graph);
  const rows: NewTankSpec[] = catalog.map(
    ({ tag: _tag, shellStats: _ss, ...spec }) => {
    const node = graph.get(spec.tankId);
    const total = totalFreeXp.get(spec.tankId) ?? 0;
    return {
      ...spec,
      researchXp: node?.researchXp ?? null,
      previousTanks: node?.previousTanks.length ? node.previousTanks : null,
      nextTanks: node?.nextTanks.length ? node.nextTanks : null,
      totalFreeXp: total > 0 ? total : null,
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
  return rows.length;
}
