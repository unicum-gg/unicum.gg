import { Region, type SkillNodeModifier } from "@unicum.gg/wargaming";
import { fieldModAffectsSpec, iconUrl } from "@unicum.gg/shared";
import { wg } from "../../client";

/** A skill-tree node's effect on one attribute (raw wot-src attribute; the front
 * maps it to a displayed characteristic, reusing the field-mod apply logic). */
export type SkillNodeEffect = SkillNodeModifier;

/** One node of the vehicle skill tree, display-ready. */
export interface SkillNode {
  id: number;
  /** `common` | `major` | `final` (importance/size) | `special` (feature node). */
  type: string;
  /** firepower | mobility | survivability | mechanics; "" for feature nodes. */
  category: string;
  /** A QoL feature (loadout swaps / role slot) rather than a stat node. */
  isFeature: boolean;
  /** Feature label for feature nodes; else the raw node loc key (a stat name or
   * a vehicle-specific mechanic key) the front turns into a readable label. */
  name: string;
  /** The feature's client description (feature nodes only); null otherwise. */
  description: string | null;
  /** The client perk icon (wot.assets), keyed by node type + the node's image. */
  image: string | null;
  effects: SkillNodeEffect[];
  /** The client's 2D layout coordinates (x, y). */
  position: [number, number];
  /** Forward-edge node ids this node unlocks. */
  unlocks: number[];
  /** Reachable as soon as ANY predecessor is unlocked (else all are needed). */
  unlockStrategyAny: boolean;
}

/** A tank's vehicle skill tree (the tier-XI "upgrades" graph). */
export interface TankSkillTree {
  rootStep: number;
  nodes: SkillNode[];
}

// The client's per-node perk icons live under the node's own type folder, keyed
// by its `imgName` (a stat/mechanic node) or the camelCased feature key.
const SKILL_ICON = iconUrl("skillTree/tree/perks");
const camel = (k: string): string =>
  k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const skillIcon = (type: string, img: string): string | null =>
  img ? `${SKILL_ICON}/${type}/skills/large/${img}.png` : null;

/**
 * A tank's vehicle skill tree ("upgrades", tier XI only): the node graph with
 * each node's stat effects and its 2D layout, so the page can render the tree
 * and apply unlocked nodes to the characteristics. Null when the vehicle has no
 * skill tree (every tier <= X vehicle, which uses field modifications instead).
 */
export async function getTankSkillTree(
  region: Region,
  tankId: number,
): Promise<TankSkillTree | null> {
  const r = wg.region(region);
  const st = await r.source.skillTree.skillTree(tankId);
  if (!st || st.nodes.length === 0) return null;
  // Every node's name + description comes from the client localization
  // (`veh_skill_tree.po`), keyed by feature key or stat-node loc name, so nothing
  // is labelled by a hand-kept map or a humanized key.
  const titles = await r.source.postProgression.nodeTitles();

  const nodes: SkillNode[] = st.nodes.map((n) => {
    if (n.action === "feature") {
      return {
        id: n.id,
        type: n.type,
        category: "",
        isFeature: true,
        name: titles[n.value]?.name ?? n.value,
        description: titles[n.value]?.description || null,
        image: skillIcon(n.type, camel(n.value)),
        effects: [],
        position: n.position,
        unlocks: n.unlocks,
        unlockStrategyAny: n.unlockStrategyAny,
      };
    }
    const mod = st.modifications[n.value];
    const loc = mod?.locName ?? n.value;
    return {
      id: n.id,
      type: n.type,
      category: mod?.category ?? "",
      isFeature: false,
      name: titles[loc]?.name ?? loc,
      description: titles[loc]?.description || null,
      image: skillIcon(n.type, mod?.imgName ?? ""),
      // Only effects that move a displayed characteristic; a vehicle-mechanic
      // node's exotic ability parameters are explained by its description, not
      // shown as raw rows.
      effects: (mod?.modifiers ?? []).filter((e) =>
        fieldModAffectsSpec(e.attribute),
      ),
      position: n.position,
      unlocks: n.unlocks,
      unlockStrategyAny: n.unlockStrategyAny,
    };
  });

  return { rootStep: st.rootStep, nodes };
}
