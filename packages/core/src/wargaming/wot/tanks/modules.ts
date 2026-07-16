import { ModuleType, Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

/** A node of the vehicle's module research DAG, edges included. */
export type TankModuleNode = {
  moduleId: number;
  type: ModuleType;
  name: string;
  tier: number | null;
  image: string | null;
  isDefault: boolean;
  priceXp: number;
  priceCredit: number;
  /** Modules this one unlocks (may cross classes, e.g. a turret unlocking a gun). */
  nextModules: number[];
  /** Vehicles this module's research opens up. */
  nextTanks: number[];
};

// Stable output order: the in-game research screen's row order, then research
// XP within a class.
const TYPE_ORDER: ModuleType[] = [
  ModuleType.Gun,
  ModuleType.Turret,
  ModuleType.Engine,
  ModuleType.Chassis,
  ModuleType.Radio,
];

// The stored image URLs are legacy WG CDN links served over plain http;
// upgrade so they aren't blocked as mixed content on our https pages.
function httpsUrl(url: string | null | undefined): string | null {
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

/**
 * A tank's module research tree from the Tankopedia `modules_tree`, as the raw
 * DAG (nodes + `nextModules`/`nextTanks` edges) so the UI can lay it out like
 * the in-game Modules screen: stock modules on the left, upgrades rightward
 * following the unlock edges, researchable vehicles at the end. Tier and image
 * come from a second `encyclopedia/modules` lookup. Both endpoints sit behind
 * the SDK's static-endpoint cache (6h), so a warm render costs no WG call.
 * Returns an empty array for tanks WG doesn't know.
 */
export async function getTankModules(
  region: Region,
  tankId: number,
): Promise<TankModuleNode[]> {
  const vehicles = await wg
    .region(region)
    .api.wot.encyclopedia.vehicles({ tankId: [tankId], fields: ["modules_tree"] });
  const tree = vehicles[String(tankId)]?.modules_tree;
  if (!tree) return [];

  const nodes = Object.values(tree);
  if (nodes.length === 0) return [];
  const details = await wg.region(region).api.wot.encyclopedia.modules({
    moduleId: nodes.map((n) => n.module_id),
    fields: ["module_id", "tier", "image"],
  });

  return nodes
    .map((node): TankModuleNode => {
      const detail = details[String(node.module_id)];
      return {
        moduleId: node.module_id,
        type: node.type as ModuleType,
        name: node.name,
        tier: detail?.tier ?? null,
        image: httpsUrl(detail?.image),
        isDefault: node.is_default,
        priceXp: node.price_xp,
        priceCredit: node.price_credit,
        nextModules: node.next_modules ?? [],
        nextTanks: node.next_tanks ?? [],
      };
    })
    .sort((a, b) => {
      const t = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      if (t !== 0) return t;
      return a.priceXp - b.priceXp;
    });
}
