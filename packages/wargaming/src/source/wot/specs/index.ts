import { XMLParser } from "fast-xml-parser";
import { Region } from "../../../region";
import type { Transport } from "../../../client/transport";
import { RateLimit } from "../../../client/rate-limiter";
import { fetchNations } from "../nations";
import {
  BRANCH_BY_REGION,
  computeTankId,
  rawUrl,
  VEHICLE_TYPES,
  WOTSRC_CACHE_TTL_MS,
  WotSrcBranch,
} from "../mirror";
import { derive, deriveConfigs } from "./derive";
import { getShellKinds } from "./shell-kinds";
import { resolveRef } from "../localization";

/**
 * A fully-derived, top-configuration stat block for one vehicle, computed from
 * the raw WoT client XML (IzeBerg/wot-src mirror). Every field is the stock
 * value with the top module of each slot equipped (last module in document
 * order), no crew/equipment bonuses applied. `null` marks a value that does not
 * exist for that vehicle class (e.g. `intraClipReload` on a single-shot gun, or
 * `turretArmorFront` on a casemate TD).
 */
/**
 * One derived stat block for a specific module combination, tagged by the
 * wot-src module keys that produced it. The keys are opaque wot-src identifiers
 * (e.g. `_AMX_50_120`); the consumer bridges them to WG moduleIds by matching a
 * few raw stats (`spec.reload`, `enginePower`, `turretTraverse`, `hullTraverse`,
 * `radioRange`) against WG's `vehicleprofiles`, since both sources derive from
 * the same game data and those numbers are identical.
 */
export interface WotSrcConfig {
  keys: {
    chassis: string;
    turret: string;
    gun: string;
    engine: string;
    radio: string;
  };
  spec: WotSrcSpec;
}

/** Every valid module combination for one tank, each fully derived. */
export interface TankConfigs {
  tankId: number;
  tag: string;
  configs: WotSrcConfig[];
}

export type WotSrcSpec = {
  tankId: number;
  tag: string;
  // Tier-XI special-ability parameters from the top gun's `<mechanics>` block,
  // keyed by path (`propellantAfterburnerGun/chargingPerSec`). Empty for the vast
  // majority of vehicles, which have no mechanic.
  mechanics: Record<string, number>;
  // firepower
  damage: number | null;
  moduleDamage: number | null;
  splashRadius: number | null;
  reload: number | null;
  rof: number | null;
  intraClipReload: number | null;
  clipSize: number | null;
  dpm: number | null;
  penetration: number | null;
  penetration500: number | null;
  caliber: number | null;
  shellVelocity: number | null;
  maxRange: number | null;
  ammoCapacity: number | null;
  // gun handling
  accuracy: number | null;
  aimTime: number | null;
  dispMoving: number | null;
  dispTankTraverse: number | null;
  dispTurretTraverse: number | null;
  dispAfterShot: number | null;
  dispWhileDamaged: number | null;
  gunArc: number | null;
  depression: number | null;
  elevation: number | null;
  // mobility
  speedForward: number | null;
  speedBackward: number | null;
  hullTraverse: number | null;
  turretTraverse: number | null;
  enginePower: number | null;
  powerWeight: number | null;
  terrainHard: number | null;
  terrainMedium: number | null;
  terrainSoft: number | null;
  // survivability
  health: number | null;
  engineHealth: number | null;
  engineFireChance: number | null;
  hullArmorFront: number | null;
  hullArmorSide: number | null;
  hullArmorRear: number | null;
  turretArmorFront: number | null;
  turretArmorSide: number | null;
  turretArmorRear: number | null;
  trackArmor: number | null;
  trackHealth: number | null;
  trackRepaired: number | null;
  trackRepairTime: number | null;
  ammoRackHealth: number | null;
  ammoRackRepaired: number | null;
  engineRepaired: number | null;
  fuelTankHealth: number | null;
  fuelTankRepaired: number | null;
  turretRingHealth: number | null;
  turretRingRepaired: number | null;
  viewportHealth: number | null;
  viewportRepaired: number | null;
  // other
  weight: number | null;
  viewRange: number | null;
  radioRange: number | null;
  camoStill: number | null;
  camoMoving: number | null;
  camoStillFiring: number | null;
  camoMovingFiring: number | null;
  // economics (from list.xml price + default shell price)
  buyCredits: number | null;
  buyGold: number | null;
  shellCost: number | null;
  ammoCost: number | null;
  // Per-shell velocity, splash radius and 500m penetration by shell kind (WG's
  // ammo lacks them); used by the ammo panel. Not a DB column — dropped before
  // the upsert.
  shellStats: {
    type: string;
    velocity: number;
    splash: number | null;
    pen500: number | null;
    icon: string | null;
    /** Per-shell price in credits (premium ammo included; all credit-priced). */
    cost: number | null;
    /** Armor damage and near penetration, to disambiguate two shells of the same
     * kind when matching against the WG shell (kind alone is not unique). */
    damage: number | null;
    pen: number | null;
    /** The shell's own localization ref (`#<file>:<key>`), resolved into `name`. */
    userString: string | null;
    /** Display names from WoT's localization, resolved by `configs()` for the
     * ammo panel (null in the batch catalog, or when localization has no entry):
     * `shortName` = the kind's short code (AP/HEAT/…), `kindName` = the kind's
     * full name (High-Explosive/…), `name` = this specific shell's own name
     * (e.g. `122 mm UOF-471`). */
    shortName: string | null;
    kindName: string | null;
    name: string | null;
  }[];
};

export type XmlNode = Record<string, unknown>;


export function isObject(v: unknown): v is XmlNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * WoT XML leaves that carry a `<!--BW_String-->` comment are parsed as their
 * text value (comments are stripped by the parser config), so most numeric
 * leaves are plain strings. Some, however, are objects wrapping a `#text` (when
 * a leaf also has child elements). Read either shape as a number.
 */
export function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (isObject(v) && "#text" in v) return num((v as XmlNode)["#text"]);
  return null;
}

/** First whitespace-separated token of a string leaf, as a number. */
function firstNum(v: unknown): number | null {
  if (v == null) return null;
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  const first = s.trim().split(/\s+/)[0];
  const n = Number.parseFloat(first);
  return Number.isFinite(n) ? n : null;
}

/** All whitespace-separated tokens of a string leaf, as numbers. */
export function numList(v: unknown): number[] {
  if (v == null) return [];
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  return s
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n));
}

/** Whitespace-separated string tokens of a string leaf. */
export function tokens(v: unknown): string[] {
  if (v == null) return [];
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Deep-merge `override` onto `base`; scalar/array overrides win outright. */
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isObject(base)) return override === undefined ? base : override;
  if (!isObject(override)) return override === undefined ? base : override;
  const out: XmlNode = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

/**
 * Module slots list their modules as child elements keyed by name; the LAST key
 * in document order is the TOP module. A `shared` sub-key (the container's own
 * marker, never a module) is skipped.
 */
export function moduleKeys(slot: unknown): string[] {
  if (!isObject(slot)) return [];
  return Object.keys(slot).filter((k) => k !== "shared");
}
export function topModuleKey(slot: unknown): string | null {
  const keys = moduleKeys(slot);
  return keys.length ? keys[keys.length - 1] : null;
}

/**
 * Resolve a module to its full definition. `inline` is the vehicle-file block
 * (may be the literal string `"shared"`, or a partial object of overrides).
 * `sharedDef` is the component-file definition (or undefined). The result is a
 * deep-merge with vehicle-inline fields winning.
 */
export function resolveModule(inline: unknown, sharedDef: unknown): XmlNode | null {
  const inlineObj = isObject(inline) ? inline : {};
  if (sharedDef === undefined) return isObject(inline) ? inline : null;
  const merged = deepMerge(sharedDef, inlineObj);
  return isObject(merged) ? merged : null;
}

/**
 * Vehicle specs from the IzeBerg/wot-src client-scripts mirror. Loops all
 * nations with the shared component files fetched once per nation, and derives
 * the stock top-configuration stat block for every combat vehicle.
 */
export class SourceSpecsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async catalog(): Promise<WotSrcSpec[]> {
    const branch = BRANCH_BY_REGION[this.region];
    const nations = await fetchNations(this.t, branch);
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const results = await Promise.all(
      nations.map((nation, idx) =>
        this.#nation(branch, nation, idx, parser).catch((err) => {
          console.error(`[wotsrc-specs-${this.region}] ${nation} failed:`, err);
          return [] as WotSrcSpec[];
        }),
      ),
    );
    return results.flat();
  }

  async #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }

  #root(parser: XMLParser, xml: string): XmlNode {
    const doc = parser.parse(xml) as XmlNode;
    const key = Object.keys(doc).find((k) => k !== "?xml");
    const root = key ? doc[key] : undefined;
    return isObject(root) ? root : {};
  }

  /** The `<shared>` block of a component file, keyed by module name. */
  #shared(root: XmlNode): XmlNode {
    return isObject(root.shared) ? root.shared : {};
  }

  async #nation(
    branch: WotSrcBranch,
    nation: string,
    nationIdx: number,
    parser: XMLParser,
  ): Promise<WotSrcSpec[]> {
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const comp = (c: string) => this.#text(rawUrl(branch, `${base}/components/${c}.xml`));
    const [listXml, gunsXml, shellsXml, turretsXml, enginesXml, chassisXml, radiosXml, fuelXml] =
      await Promise.all([
        this.#text(rawUrl(branch, `${base}/list.xml`)),
        comp("guns"),
        comp("shells"),
        comp("turrets"),
        comp("engines"),
        comp("chassis"),
        comp("radios"),
        comp("fuelTanks"),
      ]);

    const list = this.#root(parser, listXml);
    const guns = this.#shared(this.#root(parser, gunsXml));
    // shells.xml lists shell defs directly under root (no <shared> wrapper).
    const shells = this.#root(parser, shellsXml);
    const turrets = this.#shared(this.#root(parser, turretsXml));
    const engines = this.#shared(this.#root(parser, enginesXml));
    const chassis = this.#shared(this.#root(parser, chassisXml));
    const radios = this.#shared(this.#root(parser, radiosXml));
    const fuelTanks = this.#shared(this.#root(parser, fuelXml));

    const shared = { guns, shells, turrets, engines, chassis, radios, fuelTanks };

    const out: WotSrcSpec[] = [];
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      const localId = Number.parseInt(String(entry.id ?? "").trim(), 10);
      if (!Number.isFinite(localId)) continue;
      const type = this.#extractType(entry.tags);
      if (!type) continue;
      try {
        const vehXml = await this.#text(rawUrl(branch, `${base}/${tag}.xml`));
        const root = this.#root(parser, vehXml);
        const spec = derive(
          computeTankId(nationIdx, localId),
          tag,
          root,
          shared,
          entry,
        );
        out.push(spec);
      } catch (err) {
        console.error(`[wotsrc-specs-${this.region}] ${nation}/${tag} failed:`, err);
      }
    }
    return out;
  }

  #extractType(tags: unknown): string | null {
    if (typeof tags !== "string") return null;
    for (const t of tags.split(/\s+/)) if (VEHICLE_TYPES.has(t)) return t;
    return null;
  }

  async configs(tankId: number): Promise<TankConfigs | null> {
    const branch = BRANCH_BY_REGION[this.region];
    const nations = await fetchNations(this.t, branch);
    const nationIdx = (tankId >> 4) & 0xf;
    const localId = tankId >> 8;
    const nation = nations[nationIdx];
    if (!nation) return null;

    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const comp = (c: string) => this.#text(rawUrl(branch, `${base}/components/${c}.xml`));
    const [listXml, gunsXml, shellsXml, turretsXml, enginesXml, chassisXml, radiosXml, fuelXml] =
      await Promise.all([
        this.#text(rawUrl(branch, `${base}/list.xml`)),
        comp("guns"),
        comp("shells"),
        comp("turrets"),
        comp("engines"),
        comp("chassis"),
        comp("radios"),
        comp("fuelTanks"),
      ]);

    const list = this.#root(parser, listXml);
    const shared = {
      guns: this.#shared(this.#root(parser, gunsXml)),
      shells: this.#root(parser, shellsXml),
      turrets: this.#shared(this.#root(parser, turretsXml)),
      engines: this.#shared(this.#root(parser, enginesXml)),
      chassis: this.#shared(this.#root(parser, chassisXml)),
      radios: this.#shared(this.#root(parser, radiosXml)),
      fuelTanks: this.#shared(this.#root(parser, fuelXml)),
    };

    let match: { tag: string; entry: XmlNode } | null = null;
    for (const [tag, entry] of Object.entries(list)) {
      if (tag === "ids" || !isObject(entry)) continue;
      if (Number.parseInt(String(entry.id ?? "").trim(), 10) === localId) {
        match = { tag, entry };
        break;
      }
    }
    if (!match) return null;

    const vehXml = await this.#text(rawUrl(branch, `${base}/${match.tag}.xml`));
    const root = this.#root(parser, vehXml);
    const configs = deriveConfigs(tankId, match.tag, root, shared, match.entry);
    // Label each shell from WoT's own localization (both memoized), not a
    // hand-kept map: the kind's short code + full name from `item_types.po`, and
    // the shell's specific name from its `userString` (in the nation `.po`),
    // composed with the gun caliber (`122 mm UOF-471`).
    const fetchText = (url: string) => this.#text(url);
    const kinds = await getShellKinds(branch, fetchText);
    for (const c of configs) {
      const caliber = c.spec.caliber;
      for (const st of c.spec.shellStats) {
        const k = kinds.get(st.type);
        st.shortName = k?.short ?? null;
        st.kindName = k?.name ?? null;
        const specific = st.userString
          ? await resolveRef(st.userString, branch, fetchText)
          : null;
        st.name = specific
          ? caliber != null
            ? `${caliber} mm ${specific}`
            : specific
          : null;
      }
    }
    return { tankId, tag: match.tag, configs };
  }

  /**
   * The vehicle's crew composition from its client XML `<crew>`, plus its nation
   * (for the portraits). One entry per physical crew member, each the roles it
   * fills: the element name is the primary role, and its text lists the extra
   * roles the same member covers (a Swedish TD's driver also gunning, encoded
   * `<driver>gunner</driver>`). Several members of one role (two loaders) parse
   * as an array under that element, so each becomes its own member. Null when
   * the tank resolves to no vehicle file, or the file carries no crew.
   */
  async crew(
    tankId: number,
  ): Promise<{ nation: string; members: string[][] } | null> {
    const branch = BRANCH_BY_REGION[this.region];
    const nations = await fetchNations(this.t, branch);
    const nationIdx = (tankId >> 4) & 0xf;
    const localId = tankId >> 8;
    const nation = nations[nationIdx];
    if (!nation) return null;

    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      ignoreDeclaration: true,
    });
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const list = this.#root(
      parser,
      await this.#text(rawUrl(branch, `${base}/list.xml`)),
    );
    let tag: string | null = null;
    for (const [t, entry] of Object.entries(list)) {
      if (t === "ids" || !isObject(entry)) continue;
      if (Number.parseInt(String(entry.id ?? "").trim(), 10) === localId) {
        tag = t;
        break;
      }
    }
    if (!tag) return null;

    const root = this.#root(
      parser,
      await this.#text(rawUrl(branch, `${base}/${tag}.xml`)),
    );
    const crewNode = isObject(root.crew) ? root.crew : null;
    if (!crewNode) return null;

    const members: string[][] = [];
    for (const [role, value] of Object.entries(crewNode)) {
      // Same-role members (two loaders) parse as an array; a single one is the
      // bare value. Self-closing (`<commander/>`) carries no text, so no extra
      // role; text (`gunner`) names the further roles that member also fills.
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        const extra =
          typeof item === "string" ? item.split(/\s+/).filter(Boolean) : [];
        members.push([role, ...extra]);
      }
    }
    return members.length > 0 ? { nation, members } : null;
  }
}
