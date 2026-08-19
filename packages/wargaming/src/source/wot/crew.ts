import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { loadPo } from "./localization";
import { BRANCH_BY_REGION, rawUrl, WOTSRC_CACHE_TTL_MS } from "./mirror";

type XmlNode = Record<string, unknown>;

const isObject = (v: unknown): v is XmlNode =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];
const nums = (v: unknown): number[] =>
  String(v ?? "")
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);

/** How a crew skill changes one vehicle attribute, per crew-skill-level point.
 * `param` is the wot-src attribute name (the app maps it to a characteristic);
 * `situational` marks a conditional effect (only under specific battle
 * conditions) that is not applied to the static characteristics. */
export interface CrewSkillEffect {
  param: string;
  /** Magnitude per skill-level point; a skill trains from 0 to 100, so the total
   * effect at level L is `value * L`. */
  value: number;
  situational: boolean;
}

/** A crew skill definition from the wot-src client XML. `key` is the skill's
 * string id (`gunner_smoothTurret`, `repair`, ...), which is exactly the join
 * key of the WG `crewskills`/`crewroles` endpoints, so the app bridges effects
 * (here) to the localized name + icon (WG) without any hand-maintained map. */
export interface CrewSkillDef {
  key: string;
  /** The skill's localized name and short description, from the client's own
   * `crew_perks.po` (keyed by the skill key). Complete and correct where WG's
   * `crewskills` API returns null or a stale name; null only if the perk file
   * has no entry. */
  name: string | null;
  description: string | null;
  effects: CrewSkillEffect[];
  /** The skill's crew-training-level bonus in level points (Brothers in Arms =
   * 5), from the top-level `<crewLevelIncrease>`; 0 for a normal skill. This is
   * not a per-characteristic effect: it raises the whole crew's effective level,
   * which the game turns into a small bonus on every crew-affected stat. */
  crewLevelIncrease: number;
  /** A commander "special" ability (`UISettings/typeName` = `commanderSpecial`):
   * an innate default the game grants for free, not a trainable skill. Sixth
   * Sense is the only one, made a free commander default in update 1.18.1. */
  special: boolean;
}

/**
 * Crew skills from the wot-src client-scripts mirror. `tankmen.xml` defines every
 * skill by its string key with its per-level effects, so the app can apply skill
 * bonuses to the characteristics. Global (crew mechanics don't vary by vehicle),
 * read once per region branch.
 */
export class SourceCrewResource {
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

  async skills(): Promise<CrewSkillDef[]> {
    const branch = BRANCH_BY_REGION[this.region];
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const [xml, perks] = await Promise.all([
      this.#text(
        rawUrl(branch, "sources/res/scripts/item_defs/tankmen/tankmen.xml"),
      ),
      // The client's own perk localization: `<key>/name` + `<key>/shortDescription`.
      loadPo(branch, "crew_perks", (url) => this.#text(url)),
    ]);
    const doc = parser.parse(xml) as XmlNode;
    const rootKey = Object.keys(doc).find((k) => k !== "?xml");
    const root = rootKey && isObject(doc[rootKey]) ? (doc[rootKey] as XmlNode) : {};
    const skills = isObject(root.skills) ? root.skills : {};

    const out: CrewSkillDef[] = [];
    for (const [key, body] of Object.entries(skills)) {
      if (!isObject(body)) continue;
      const ui = isObject(body.UISettings) ? body.UISettings : {};
      const descr = isObject(ui.descr) ? ui.descr : {};
      const effects: CrewSkillEffect[] = [];
      for (const a of arr<XmlNode>(descr.arg)) {
        if (!isObject(a)) continue;
        const param = String(a.paramName ?? "");
        const value = nums(a.value)[0];
        if (!param || !Number.isFinite(value)) continue;
        effects.push({
          param,
          value,
          situational: String(a.situationalParam ?? "").trim() === "true",
        });
      }
      const crewLevelIncrease = nums(body.crewLevelIncrease)[0];
      out.push({
        key,
        name: perks.get(`${key}/name`) ?? null,
        // Prefer `alt/description`: it is fuller and more accurate than the terse
        // `shortDescription` (which is empty for the newer role perks, and even
        // wrong for a few skills where WG copy-pasted the wrong text, e.g.
        // armorPatching). Fall back to `shortDescription` for the rare skill that
        // has only that.
        description:
          perks.get(`${key}/alt/description`) ??
          perks.get(`${key}/shortDescription`) ??
          null,
        effects,
        crewLevelIncrease: Number.isFinite(crewLevelIncrease)
          ? crewLevelIncrease
          : 0,
        special: String(ui.typeName ?? "").trim() === "commanderSpecial",
      });
    }
    return out;
  }

  /**
   * Every perk's localized name from `crew_perks.po`, keyed by perk key. Covers
   * more than `skills()` (which is limited to trainable tankmen skills): battle
   * boosters reference perks like `radioman_lastEffort` ("Call for Vengeance")
   * that are not trainable skills, so the directive facade resolves names here.
   * Same memoized `.po` fetch as `skills()`, so it costs nothing extra.
   */
  async perkNames(): Promise<Map<string, string>> {
    const branch = BRANCH_BY_REGION[this.region];
    const perks = await loadPo(branch, "crew_perks", (url) => this.#text(url));
    const names = new Map<string, string>();
    for (const [id, str] of perks) {
      const m = /^(.+)\/name$/.exec(id);
      if (m && str) names.set(m[1], str);
    }
    return names;
  }
}
