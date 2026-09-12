import { Region, type SkillNodeModifier, WotSrcBranch } from "@unicum.gg/wargaming";
import { assetsRefFor, fieldModAffectsSpec, iconUrl } from "@unicum.gg/shared";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// wot-src client data changes only on a game patch (refreshed daily by
// vehicles-cron); the parsed result is cached in Redis for a day (shared across
// instances, surviving deploys).
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;

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
  /**
   * The client key `name` and `description` were resolved from, so the front can
   * resolve the same key in the reader's language.
   *
   * The payload is built once from the English catalogue and cached per region,
   * so the text on it is English whoever is reading. Carrying the key is what
   * lets the tooltip look the node up in `game/skill-tree`, exactly as a device
   * carries its `descriptionKey`.
   */
  nameKey: string;
  /**
   * The figure that fills the `{value}` hole in the node's own description,
   * already reduced to what the sentence asks for.
   *
   * The sentence carries the direction and the unit ("Increases ... by {value}%",
   * "Reduces the cooldown ... by {value} s"), so what goes in the hole is the
   * magnitude: a `mul` of 1.1 or 0.9 is 10 (percent), an `add` of -5 is 5. Null
   * for a node whose description has no hole.
   */
  descriptionValue: number | null;
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
// Resolved per branch, not once at module load: a node's icon can be keyed by
// the vehicle (`s41_mechanic_0.png`), and an unreleased vehicle's icons exist
// only on the test branch of the assets mirror.
const skillIconBase = (branch?: WotSrcBranch) =>
  iconUrl("skillTree/tree/perks", assetsRefFor(branch));
const camel = (k: string): string =>
  k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const skillIcon = (base: string, type: string, img: string): string | null =>
  img ? `${base}/${type}/skills/large/${img}.png` : null;

/**
 * A tank's vehicle skill tree ("upgrades", tier XI only): the node graph with
 * each node's stat effects and its 2D layout, so the page can render the tree
 * and apply unlocked nodes to the characteristics. Null when the vehicle has no
 * skill tree (every tier <= X vehicle, which uses field modifications instead).
 */
/**
 * Bumped whenever the node shape below changes.
 *
 * This cache sits UNDER the tank detail cache and outlives a deploy on its own,
 * so bumping the outer one is not enough: the detail payload is recomputed and
 * reads a node this still holds without the new field, for a full day, with no
 * error to show for it. `getTankLoadout` carries the same counter after the
 * same day of chasing a field that was written and never arrived.
 */
const SKILL_TREE_SHAPE_VERSION = 2;

/**
 * The magnitude a `{value}` hole wants, from the node's `kpi` entry.
 *
 * A `mul` is a factor either side of 1 and the sentence names the direction, so
 * the distance from 1 is what it asks for, as a percentage. Rounded to one
 * decimal because the factors are authored with two (1.075 is 7.5%) and the
 * float arithmetic would otherwise print 7.499999999999996.
 */
function descriptionValue(
  kpi: { type: "mul" | "add"; value: number } | null,
): number | null {
  if (!kpi) return null;
  const magnitude =
    kpi.type === "mul" ? Math.abs(kpi.value - 1) * 100 : Math.abs(kpi.value);
  return Math.round(magnitude * 10) / 10;
}

export function getTankSkillTree(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<TankSkillTree | null> {
  return cachedInRedis(
    `wotsrc:skill-tree:v${SKILL_TREE_SHAPE_VERSION}:${region}${branch ? `:${branch}` : ""}:${tankId}`,
    WOTSRC_TTL_SECONDS,
    () => computeTankSkillTree(region, tankId, branch),
  );
}

async function computeTankSkillTree(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<TankSkillTree | null> {
  const r = wg.region(region);
  const st = await r.source.skillTree.skillTree(tankId, branch);
  if (!st || st.nodes.length === 0) return null;
  // Every node's name + description comes from the client localization
  // (`veh_skill_tree.po`), keyed by feature key or stat-node loc name, so nothing
  // is labelled by a hand-kept map or a humanized key.
  const titles = await r.source.postProgression.nodeTitles(branch);
  const iconBase = skillIconBase(branch);

  const nodes: SkillNode[] = st.nodes.map((n) => {
    if (n.action === "feature") {
      return {
        id: n.id,
        type: n.type,
        category: "",
        isFeature: true,
        name: titles[n.value]?.name ?? n.value,
        nameKey: n.value,
        descriptionValue: null,
        description: titles[n.value]?.description || null,
        image: skillIcon(iconBase, n.type, camel(n.value)),
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
      nameKey: loc,
      descriptionValue: descriptionValue(mod?.kpi ?? null),
      description: titles[loc]?.description || null,
      image: skillIcon(iconBase, n.type, mod?.imgName ?? ""),
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
