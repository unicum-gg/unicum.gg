import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { fetchNations } from "./nations";
import { loadPo } from "./localization";
import { BRANCH_BY_REGION, rawUrl } from "./mirror";

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

/** How a field modification changes one vehicle attribute. Attributes share the
 * equipment namespace (`miscAttrs/*` factor bag) plus direct descriptor paths
 * (`descrAttrs/hull/maxHealth`, `descrAttrs/shot0/piercingPower`, ...). */
export interface PostProgressionModifier {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

/** A field modification (a base step buff or one side of a pair), from
 * `post_progression/modifications.xml`. `locName` keys the display name in
 * `artefacts.po` (`<locName>/name`); `imgName` the client icon basename. */
export interface PostProgressionModification {
  key: string;
  locName: string;
  imgName: string;
  modifiers: PostProgressionModifier[];
}

/** A dual ("Modification I/II") choice: two mutually exclusive modifications. */
export interface PostProgressionPair {
  key: string;
  first: string;
  second: string;
}

export enum PostProgressionAction {
  Feature = "feature",
  Modification = "modification",
  PairModification = "pair_modification",
}

/** One step of a post-progression tree. `minTier` gates the step to vehicles of
 * that tier and above (the role-slot step needs VIII, the level-7 step IX). */
export interface PostProgressionStep {
  id: number;
  level: number;
  action: PostProgressionAction;
  /** The feature name, modification key, or pair key the step unlocks. */
  value: string;
  minTier: number | null;
}

/** A vehicle's field-modification tree with the referenced modifications and
 * pairs resolved from the global catalogues. */
export interface TankPostProgression {
  tankId: number;
  tag: string;
  tier: number;
  /** The tree key: the vehicle's own override, or its role tag. */
  treeKey: string;
  steps: PostProgressionStep[];
  modifications: Record<string, PostProgressionModification>;
  pairs: Record<string, PostProgressionPair>;
}

/**
 * Field modifications (vehicle post progression) from the wot-src client
 * scripts. The global data lives in `item_defs/vehicles/common/post_progression`
 * (one tree per vehicle role plus per-vehicle special trees); a vehicle maps to
 * its tree through an explicit `postProgressionTree` override in its own XML, or
 * its `role_*` tag. Roles only exist for tiers VI+ (`ROLE_LEVELS`), so lower
 * tiers have no tree.
 */
export class SourcePostProgressionResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async #text(url: string): Promise<string> {
    const res = await this.t.get(new URL(url), { limit: RateLimit.None });
    return res.text();
  }

  #root(parser: XMLParser, xml: string): XmlNode {
    const doc = parser.parse(xml) as XmlNode;
    const key = Object.keys(doc).find((k) => k !== "?xml");
    const root = key ? doc[key] : undefined;
    return isObject(root) ? root : {};
  }

  #modifiers(entry: XmlNode): PostProgressionModifier[] {
    const block = isObject(entry.modifiers) ? entry.modifiers : {};
    const out: PostProgressionModifier[] = [];
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

  #modifications(
    parser: XMLParser,
    xml: string,
  ): Record<string, PostProgressionModification> {
    const root = this.#root(parser, xml);
    const out: Record<string, PostProgressionModification> = {};
    for (const [key, entry] of Object.entries(root)) {
      if (key === "xmlns:xmlref" || !isObject(entry)) continue;
      out[key] = {
        key,
        locName: String(entry.locName ?? key),
        imgName: String(entry.imgName ?? ""),
        modifiers: this.#modifiers(entry),
      };
    }
    return out;
  }

  #pairs(parser: XMLParser, xml: string): Record<string, PostProgressionPair> {
    const root = this.#root(parser, xml);
    const out: Record<string, PostProgressionPair> = {};
    for (const [key, entry] of Object.entries(root)) {
      if (key === "xmlns:xmlref" || !isObject(entry)) continue;
      const first = isObject(entry.first) ? String(entry.first.name ?? "") : "";
      const second = isObject(entry.second)
        ? String(entry.second.name ?? "")
        : "";
      if (first && second) out[key] = { key, first, second };
    }
    return out;
  }

  #steps(tree: XmlNode): PostProgressionStep[] {
    const steps = isObject(tree.steps) ? tree.steps : {};
    const out: PostProgressionStep[] = [];
    for (const step of arr<XmlNode>(steps.step)) {
      if (!isObject(step)) continue;
      const action = isObject(step.action) ? step.action : {};
      const type = String(action.type ?? "");
      if (
        type !== PostProgressionAction.Feature &&
        type !== PostProgressionAction.Modification &&
        type !== PostProgressionAction.PairModification
      )
        continue;
      // The only vehicle gating used is a tier floor inside <include><vehicle>.
      let minTier: number | null = null;
      const vf = isObject(step.vehicleFilter) ? step.vehicleFilter : null;
      const include = vf && isObject(vf.include) ? vf.include : null;
      const vehicle =
        include && isObject(include.vehicle) ? include.vehicle : null;
      if (vehicle && vehicle.minLevel != null) {
        const n = Number(String(vehicle.minLevel).trim());
        if (Number.isFinite(n)) minTier = n;
      }
      out.push({
        id: nums(step.id)[0] ?? 0,
        level: nums(step.level)[0] ?? 0,
        action: type,
        value: String(action.value ?? ""),
        minTier,
      });
    }
    return out;
  }

  /** The localized display strings from `artefacts.po` (msgid -> msgstr); a
   * modification's name lives under `<locName>/name`. */
  async names(): Promise<Record<string, string>> {
    const branch = BRANCH_BY_REGION[this.region];
    const po = await this.#text(
      rawUrl(branch, "sources/res/text/lc_messages/artefacts.po"),
    );
    const out: Record<string, string> = {};
    let id: string | null = null;
    let value = "";
    let inStr = false;
    const unquote = (line: string): string =>
      line.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\\n/g, "\n");
    const flush = () => {
      if (id) out[id] = value;
      id = null;
      value = "";
    };
    for (const raw of po.split("\n")) {
      const line = raw.trim();
      if (line.startsWith("msgid ")) {
        flush();
        id = unquote(line.slice(6).trim());
        inStr = false;
      } else if (line.startsWith("msgstr ")) {
        value = unquote(line.slice(7).trim());
        inStr = true;
      } else if (line.startsWith('"') && inStr) {
        value += unquote(line);
      }
    }
    flush();
    return out;
  }

  /**
   * Post-progression display titles + descriptions from the client's
   * `veh_skill_tree.po` (`tooltips/title/<key>`, `tooltips/description/<key>`),
   * keyed by node/feature key. Covers both the QoL feature steps (loadout swaps,
   * the configurable role slot) shared with field modifications, and every
   * tier-XI skill-tree stat node (e.g. `f136_mechanic_0` -> "Improved Loading
   * Mechanism"), so neither is labelled by a hand-kept map.
   */
  async nodeTitles(): Promise<
    Record<string, { name: string; description: string }>
  > {
    const branch = BRANCH_BY_REGION[this.region];
    const po = await loadPo(branch, "veh_skill_tree", (url) => this.#text(url));
    const out: Record<string, { name: string; description: string }> = {};
    for (const [id, str] of po) {
      const m = /^tooltips\/(title|description)\/(.+)$/.exec(id);
      if (!m || !str) continue;
      const entry = (out[m[2]] ??= { name: "", description: "" });
      if (m[1] === "title") entry.name = str;
      else entry.description = str;
    }
    return out;
  }

  async postProgression(tankId: number): Promise<TankPostProgression | null> {
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
    const pp = "sources/res/scripts/item_defs/vehicles/common/post_progression";
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const [listXml, treesXml, modsXml, pairsXml] = await Promise.all([
      this.#text(rawUrl(branch, `${base}/list.xml`)),
      this.#text(rawUrl(branch, `${pp}/trees.xml`)),
      this.#text(rawUrl(branch, `${pp}/modifications.xml`)),
      this.#text(rawUrl(branch, `${pp}/pairs.xml`)),
    ]);

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
    // Field modifications are the tier VI-X role-tree progression. Tier XI
    // vehicles use a different, graph-based "vehicle skill tree" (the in-game
    // "upgrades", data under post_progression/veh_skill_configs): all 22 tier-XI
    // vehicles have one, no tier <= X does, so a plain tier bound is exact.
    if (tier < 6 || tier > 10) return null;
    const tags = tokens(match.entry.tags);
    const roleTag = tags.find((t) => t.startsWith("role_")) ?? null;

    const trees = this.#root(parser, treesXml);
    // The vehicle's own XML may name a special tree; else the tree keyed by the
    // vehicle tag (special vehicles), else the role tree.
    let treeKey: string | null = null;
    const vehXml = await this.#text(rawUrl(branch, `${base}/${match.tag}.xml`));
    const veh = this.#root(parser, vehXml);
    const override = String(veh.postProgressionTree ?? "").trim();
    if (override && isObject(trees[override])) treeKey = override;
    else if (isObject(trees[match.tag])) treeKey = match.tag;
    else if (roleTag && isObject(trees[roleTag])) treeKey = roleTag;
    if (!treeKey) return null;

    const steps = this.#steps(trees[treeKey] as XmlNode).filter(
      (s) => s.minTier === null || tier >= s.minTier,
    );

    // Only the modifications/pairs this tree references travel with it.
    const allMods = this.#modifications(parser, modsXml);
    const allPairs = this.#pairs(parser, pairsXml);
    const modifications: Record<string, PostProgressionModification> = {};
    const pairs: Record<string, PostProgressionPair> = {};
    for (const step of steps) {
      if (step.action === PostProgressionAction.Modification) {
        const m = allMods[step.value];
        if (m) modifications[m.key] = m;
      } else if (step.action === PostProgressionAction.PairModification) {
        const p = allPairs[step.value];
        if (!p) continue;
        pairs[p.key] = p;
        for (const side of [p.first, p.second]) {
          const m = allMods[side];
          if (m) modifications[m.key] = m;
        }
      }
    }

    return {
      tankId,
      tag: match.tag,
      tier,
      treeKey,
      steps,
      modifications,
      pairs,
    };
  }
}
