import { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { buildTankSlugIndex, type VehicleMeta } from "@unicum.gg/shared";

export type ResearchPathItem = {
  tankId: number;
  slug: string;
  meta: VehicleMeta;
  // XP spent to unlock this tank from the previous one in the path (null for the
  // tier-1 root, which is free), and its credits purchase price.
  researchXp: number | null;
  buyCredits: number | null;
};

export type ResearchBranch = {
  // The single cheapest lineage tier-1 → target (the target is the last item).
  lineage: ResearchPathItem[];
  // Tanks researchable straight from the target. Multiple entries are *parallel*
  // branches (the tree forks here), not a sequence — the UI stacks them.
  next: ResearchPathItem[];
};

/**
 * The cheapest research lineage that unlocks a tank (tier-1 → target) plus the
 * tanks it unlocks in turn. We walk the `previousTanks` edges backward, at each
 * step following the parent with the smallest `totalFreeXp` (the cheapest
 * sub-path, the same choice that produced `totalFreeXp`), until a tank with no
 * parents. `next` is the target's `nextTanks`, kept separate because several
 * next tanks are parallel forks rather than a chain. Returns empty arrays for
 * tier-1/premium tanks (nothing to research through) so callers can hide it.
 */
export async function getResearchPath(
  region: Region,
  tankId: number,
): Promise<ResearchBranch> {
  const [specs, encyclopedia] = await Promise.all([
    getAllTankSpecs(),
    getVehicleEncyclopedia(region),
  ]);

  const ids: number[] = [];
  const seen = new Set<number>();
  let current: number | undefined = tankId;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    const parents = specs.get(current)?.previousTanks;
    if (!parents || parents.length === 0) break;
    let best: number | undefined;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const p of parents) {
      const cost = specs.get(p)?.totalFreeXp ?? 0;
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
    current = best;
  }

  const index = buildTankSlugIndex(encyclopedia);
  ids.reverse(); // tier-1 → target

  const toItem = (id: number): ResearchPathItem | null => {
    const meta = encyclopedia[String(id)];
    if (!meta) return null;
    const spec = specs.get(id);
    return {
      tankId: id,
      slug: index.idToSlug.get(id) ?? String(id),
      meta,
      researchXp: spec?.researchXp ?? null,
      buyCredits: spec?.buyCredits ?? null,
    };
  };

  const lineage = ids
    .map(toItem)
    .filter((i): i is ResearchPathItem => i !== null);
  const next = (specs.get(tankId)?.nextTanks ?? [])
    .map(toItem)
    .filter((i): i is ResearchPathItem => i !== null);

  // Nothing to show for a lone tank (premium / dead-end) with no lineage and no
  // successors. A tier-1 tank keeps a 1-long lineage as long as it unlocks
  // something, so its "branch → next tanks" still renders.
  if (lineage.length < 2 && next.length === 0) return { lineage: [], next: [] };

  return { lineage, next };
}
