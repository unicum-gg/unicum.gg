import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { fetchNations } from "./nations";
import { BRANCH_BY_REGION, rawUrl, WOTSRC_CACHE_TTL_MS } from "./mirror";

type XmlNode = Record<string, unknown>;

const isObject = (v: unknown): v is XmlNode =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];
const tokens = (v: unknown): string[] =>
  String(v ?? "")
    .split(/\s+/)
    .filter(Boolean);
const nums = (v: unknown): number[] =>
  tokens(v).map(Number).filter(Number.isFinite);

/** How a skill-tree node changes one attribute (same namespace as the field-mod
 * modifiers: `miscAttrs/*` factor bag + direct `descrAttrs/*` paths). */
export interface SkillNodeModifier {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

/** A skill-tree node's stat definition (`<tag>_modifications.xml`). Vehicle
 * "mechanic" nodes carry effects on non-displayed mechanics (charge shot, ...)
 * so their `modifiers` may move nothing we render. */
export interface SkillNodeDef {
  key: string;
  imgName: string;
  locName: string;
  /** firepower | mobility | survivability | mechanics. */
  category: string;
  modifiers: SkillNodeModifier[];
}

/** One node (step) of the vehicle skill tree. A graph, not a ladder: `unlocks`
 * are forward edges, `position` is the client's 2D layout (x,y), `directions`
 * route the connectors, `unlockStrategyAny` makes a node reachable as soon as
 * ANY predecessor is unlocked (else all are required). */
export interface SkillTreeNode {
  id: number;
  /** `common` | `major` | `final` (importance tiers) | `special` (feature nodes). */
  type: string;
  level: number;
  /** `modification` node → its `<tag>_modifications.xml` key; `feature` → a QoL
   * feature key (loadout swaps, role slot). */
  action: "modification" | "feature";
  value: string;
  position: [number, number];
  unlocks: number[];
  directions: string[];
  unlockStrategyAny: boolean;
}

/** A vehicle's skill tree (the in-game "upgrades" for tier XI vehicles). */
export interface TankSkillTree {
  tankId: number;
  tag: string;
  tier: number;
  rootStep: number;
  nodes: SkillTreeNode[];
  modifications: Record<string, SkillNodeDef>;
}

/**
 * The vehicle skill tree ("upgrades") from the wot-src client scripts. Unlike
 * field modifications (the tier VI-X linear role trees), tier XI vehicles get a
 * graph-based per-vehicle tree under `post_progression/veh_skill_configs/
 * <tag>_{tree,modifications}.xml`. Only the 22 tier-XI vehicles have one.
 */
export class SourceSkillTreeResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }

  async #textOrNull(url: string): Promise<string | null> {
    try {
      return await this.t.getText(new URL(url), {
        limit: RateLimit.None,
        cache: WOTSRC_CACHE_TTL_MS,
      });
    } catch {
      return null;
    }
  }

  #root(parser: XMLParser, xml: string): XmlNode {
    const doc = parser.parse(xml) as XmlNode;
    const key = Object.keys(doc).find((k) => k !== "?xml");
    const root = key ? doc[key] : undefined;
    return isObject(root) ? root : {};
  }

  #modifiers(entry: XmlNode): SkillNodeModifier[] {
    const block = isObject(entry.modifiers) ? entry.modifiers : {};
    const out: SkillNodeModifier[] = [];
    for (const type of ["mul", "add"] as const) {
      for (const m of arr<XmlNode>(block[type])) {
        if (!isObject(m)) continue;
        const attribute = String(m.name ?? "");
        const value = nums(m.value)[0];
        if (attribute && Number.isFinite(value))
          out.push({ attribute, type, value });
      }
    }
    return out;
  }

  #nodes(tree: XmlNode): SkillTreeNode[] {
    const steps = isObject(tree.steps) ? tree.steps : {};
    const out: SkillTreeNode[] = [];
    for (const step of arr<XmlNode>(steps.step)) {
      if (!isObject(step)) continue;
      const action = isObject(step.action) ? step.action : {};
      const actionType = String(action.type ?? "");
      if (actionType !== "modification" && actionType !== "feature") continue;
      const pos = nums(step.position);
      out.push({
        id: nums(step.id)[0] ?? 0,
        type: String(step.type ?? "common"),
        level: nums(step.level)[0] ?? 0,
        action: actionType,
        value: String(action.value ?? ""),
        position: [pos[0] ?? 0, pos[1] ?? 0],
        unlocks: nums(step.unlocks),
        directions: tokens(step.directions),
        // A bare <unlockStrategyAny/> tag parses to an empty string / object.
        unlockStrategyAny: "unlockStrategyAny" in step,
      });
    }
    return out;
  }

  async skillTree(tankId: number): Promise<TankSkillTree | null> {
    const branch = BRANCH_BY_REGION[this.region];
    const nations = await fetchNations(this.t, branch);
    const nationIdx = (tankId >> 4) & 0xf;
    const localId = tankId >> 8;
    const nation = nations[nationIdx];
    if (!nation) return null;

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const listXml = await this.#text(rawUrl(branch, `${base}/list.xml`));
    const list = this.#root(parser, listXml);
    let match: { tag: string; entry: XmlNode } | null = null;
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      if (Number.parseInt(String(entry.id ?? "").trim(), 10) === localId) {
        match = { tag, entry };
        break;
      }
    }
    if (!match) return null;
    const tier = Number.parseInt(String(match.entry.level ?? "0").trim(), 10);

    const cfg =
      "sources/res/scripts/item_defs/vehicles/common/post_progression/veh_skill_configs";
    const [treeXml, modsXml] = await Promise.all([
      this.#textOrNull(rawUrl(branch, `${cfg}/${match.tag}_tree.xml`)),
      this.#textOrNull(rawUrl(branch, `${cfg}/${match.tag}_modifications.xml`)),
    ]);
    // No skill tree for this vehicle (the file only exists for tier-XI vehicles).
    if (!treeXml || !modsXml) return null;

    // The tree file wraps a single `<tag>` element (`<root><tag><steps>...`),
    // so descend one level past the `<root>` the helper strips.
    const treeRoot = this.#root(parser, treeXml);
    const tree = isObject(treeRoot[match.tag])
      ? (treeRoot[match.tag] as XmlNode)
      : (Object.values(treeRoot).find(isObject) ?? {});
    const nodes = this.#nodes(tree);
    if (nodes.length === 0) return null;

    const modsRoot = this.#root(parser, modsXml);
    const modifications: Record<string, SkillNodeDef> = {};
    for (const [key, entry] of Object.entries(modsRoot)) {
      if (key === "xmlns:xmlref" || !isObject(entry)) continue;
      modifications[key] = {
        key,
        imgName: String(entry.imgName ?? ""),
        locName: String(entry.locName ?? key),
        category: tokens(entry.categories)[0] ?? "",
        modifiers: this.#modifiers(entry),
      };
    }

    return {
      tankId,
      tag: match.tag,
      tier,
      rootStep: nums(tree.rootStep)[0] ?? 1,
      nodes,
      modifications,
    };
  }
}
