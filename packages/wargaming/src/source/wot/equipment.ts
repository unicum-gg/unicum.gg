import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { fetchNations } from "./nations";
import { loadPo } from "./localization";
import { BRANCH_BY_REGION, rawUrl, WOTSRC_CACHE_TTL_MS, WotSrcBranch } from "./mirror";

type XmlNode = Record<string, unknown>;

const isObject = (v: unknown): v is XmlNode =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];
const tokens = (v: unknown): string[] =>
  String(v ?? "")
    .split(/\s+/)
    .filter(Boolean);
const nums = (v: unknown): number[] => tokens(v).map(Number).filter(Number.isFinite);
// The `<icon>` is sometimes a bare name (`turbocharger`) and sometimes a client
// path with trailing offset coords (`../maps/icons/artefact/turbocharger.png 0 0`);
// reduce both to the bare name so a family's variants share one icon key.
const iconName = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .split(/\s+/)[0] // drop trailing offset coords ("... .png 0 0")
    .replace(/^.*\//, "") // drop the path
    .replace(/\.\w+$/, ""); // drop the extension

/** How an equipment changes one vehicle attribute. `base` applies in any slot,
 * `bonus` when the equipment's category matches the slot's category (Equipment
 * 2.0). A `mul` factor multiplies the attribute, `add` adds to it. */
export interface EquipmentEffect {
  attribute: string;
  type: "mul" | "add";
  base: number;
  bonus: number;
}

/** An equipment's acquisition grade: the credit-bought `standard` set, the
 * bond-bought improved (`bond`) variant, the event `bounty` equipment and its
 * upgraded (`bountyUpgraded`) tier, and the equip-coin `experimental` equipment
 * (a single upgradeable device that combines several effects). */
export type EquipmentGrade =
  | "standard"
  | "bond"
  | "bounty"
  | "bountyUpgraded"
  | "experimental";

/** A mountable optional device, from the wot-src client XML. `key` is the
 * wot-src identifier, which equals the WG provision `tag`, so the app can bridge
 * to WG for the localized name + icon. */
export interface EquipmentDef {
  key: string;
  /** Localization ref (`#artefacts:.../name`); the app resolves the display name. */
  userString: string;
  /** The device's localized description (resolved from `#artefacts:.../descr`). */
  description: string;
  groupName: string;
  /** The wot-src icon name (e.g. `rammer`), the stable link a directive uses to
   * point at the device it enhances (directive and device share this `<icon>`),
   * and the family key a bond variant shares with its standard device. */
  icon: string;
  grade: EquipmentGrade;
  /** Equipment 2.0 categories this device belongs to (firepower, mobility,
   * survivability, stealth). Empty for experimental equipment (multi-family). */
  categories: string[];
  effects: EquipmentEffect[];
}

/** How a directive (battle booster) changes one attribute of the device it
 * enhances: a `mul` scales it, an `add` shifts it. */
export interface DirectiveEffect {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

/** A directive (battle booster). Two kinds:
 * - equipment: enhances a mounted optional device; `icon` equals the device's
 *   `<icon>`, so the app links the two without a hand-maintained map, and
 *   `effect` scales one of that device's attributes.
 * - crew: boosts a crew skill/perk (`skillName`), by multiplying its effective
 *   level (`SkillEquipment`, `perkLevelMultiplier`) or its efficiency
 *   (`FactorSkillBattleBooster`, `efficiencyFactor`). Its `icon` is the skill's
 *   key. Some crew directives (`SixthSense`, `LastEffort`, ...) don't map to a
 *   skill we model and carry no `skillName`. */
export interface DirectiveDef {
  key: string;
  icon: string;
  /** The directive's localized description (resolved from `#artefacts:.../...`). */
  description: string;
  effect: DirectiveEffect | null;
  /** The crew skill this directive boosts (crew directives only). */
  skillName?: string;
  /** `level` scales the skill's effective level, `efficiency` its effect. */
  boostKind?: "level" | "efficiency";
  boostValue?: number;
}

/** How a consumable passively changes one vehicle attribute (all `mul`). */
export interface ConsumableEffect {
  attribute: string;
  value: number;
}

/** A mountable consumable (repair kit, first aid kit, extinguisher, food, fuel,
 * ...), bridged to WG for its name + icon via `key` (= the WG provision tag). */
export interface ConsumableDef {
  key: string;
  userString: string;
  /** The consumable's localized description (resolved from `#artefacts:.../descr`). */
  description: string;
  icon: string;
  effects: ConsumableEffect[];
  /** The consumable's game category, from its `<tags>` (`repairkit`, `medkit`,
   * `extinguisher`, `fuel`, `stimulator`); "" when none is present. */
  category: string;
}

/** One equipment (optional device) slot on a vehicle. `category` is the slot's
 * Equipment 2.0 category (null for a legacy universal slot); an equipment gets
 * its bonus effect when its category matches. The role slot is player-swappable
 * between `roleOptions`. */
export interface EquipmentSlot {
  category: string | null;
  role: boolean;
  roleOptions?: string[];
}

/** A vehicle's equipment loadout options: its slots and every compatible
 * device. */
export interface TankLoadout {
  tankId: number;
  tag: string;
  slots: EquipmentSlot[];
  equipment: EquipmentDef[];
  /** Directives (battle boosters) that enhance an optional device; the app keeps
   * only those whose device is in `equipment` (matched by `icon`). */
  directives: DirectiveDef[];
  /** Consumables the vehicle can mount (repair/first-aid kits, extinguishers,
   * food, fuel, ...), in three generic slots. */
  consumables: ConsumableDef[];
}

/** wot-src supply-slot type ids that carry an optional device (equipment). */
interface SlotType {
  type: string;
  categories: string[];
}

/**
 * Equipment loadouts from the wot-src client-scripts mirror. Reads the global
 * supply-slot type table + optional-devices catalogue once, then decodes a
 * vehicle's own `supplySlots`/`customRoleSlotOptions` and filters the catalogue
 * by the vehicle's tags/tier.
 */
export class SourceEquipmentResource {
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

  #root(parser: XMLParser, xml: string): XmlNode {
    const doc = parser.parse(xml) as XmlNode;
    const key = Object.keys(doc).find((k) => k !== "?xml");
    const root = key ? doc[key] : undefined;
    return isObject(root) ? root : {};
  }

  /** slot type id -> {type, categories} from supply_slot_types.xml. */
  #slotTypes(parser: XMLParser, xml: string): Map<number, SlotType> {
    const root = this.#root(parser, xml);
    const out = new Map<number, SlotType>();
    for (const slot of arr<XmlNode>(isObject(root.slots) ? root.slots.slot : [])) {
      const id = Number(slot.id);
      if (!Number.isFinite(id)) continue;
      out.set(id, {
        type: String(slot.type ?? ""),
        categories: tokens(slot.categories),
      });
    }
    return out;
  }

  /** True when a device's `vehicleFilter` admits a vehicle with these tags/tier. */
  #matches(vf: unknown, tier: number, tags: Set<string>, nation: string): boolean {
    if (!isObject(vf)) return true;
    const one = (blk: unknown): boolean => {
      if (!isObject(blk)) return true;
      // A nation filter can sit on the block itself (consumables) rather than in
      // a nested <vehicle> (equipment), so check it at both levels.
      if (blk.nations && !tokens(blk.nations).includes(nation)) return false;
      const v = isObject(blk.vehicle) ? blk.vehicle : undefined;
      if (!isObject(v)) return true;
      if (v.minLevel && tier < Number(v.minLevel)) return false;
      if (v.maxLevel && tier > Number(v.maxLevel)) return false;
      // `tags` on a vehicle filter is an OR: the vehicle needs any one of them.
      if (v.tags && !tokens(v.tags).some((t) => tags.has(t))) return false;
      // `mandatoryTags` is an AND: the vehicle must have all of them (e.g. an
      // exclude of `wheeledVehicle lightTank` only bites wheeled lights). Without
      // this the block matched every vehicle, wrongly excluding e.g. turbocharger.
      if (v.mandatoryTags && !tokens(v.mandatoryTags).every((t) => tags.has(t)))
        return false;
      if (v.nations && !tokens(v.nations).includes(nation)) return false;
      return true;
    };
    if (vf.include && !arr(vf.include).some(one)) return false;
    if (vf.exclude && arr(vf.exclude).some(one)) return false;
    return true;
  }

  /** The directives (battle boosters) from equipments.xml. Two kinds: equipment
   * directives target a device (their script's first level carries a
   * `deviceFilter`; `<icon>` links to the device), crew directives boost a crew
   * skill (`SkillEquipment`/`FactorSkillBattleBooster` script, `<skillName>`;
   * `<icon>` is the skill key). */
  #directives(parser: XMLParser, xml: string): DirectiveDef[] {
    const root = this.#root(parser, xml);
    const out: DirectiveDef[] = [];
    for (const [key, item] of Object.entries(root)) {
      if (!isObject(item) || String(item.type) !== "battleBoosters") continue;
      const script = isObject(item.script) ? item.script : {};
      const cls = String(script["#text"] ?? "").trim().split(/\s+/)[0];
      const icon = String(item.icon ?? "");
      if (!icon) continue;
      // Directive description: the specific `short_special`, else the generic one.
      const description = String(
        item.shortDescriptionSpecial ?? item.description ?? "",
      );

      // Crew directive: it boosts a crew skill rather than a device.
      const skillName = String(script.skillName ?? "");
      if (skillName) {
        // SkillEquipment scales the skill's effective level; a
        // FactorSkillBattleBooster scales its efficiency. Skills we don't model
        // (Sixth Sense, Last Effort, ...) still list here without a boost.
        const perkMul = nums(script.perkLevelMultiplier)[0];
        const effFactor = nums(script.efficiencyFactor)[0];
        const boostKind = Number.isFinite(perkMul)
          ? "level"
          : Number.isFinite(effFactor)
            ? "efficiency"
            : undefined;
        const boostValue = boostKind === "level" ? perkMul : effFactor;
        out.push({
          key,
          icon,
          description,
          effect: null,
          skillName,
          boostKind,
          boostValue,
        });
        continue;
      }

      const level = arr<XmlNode>(script.level)[0];
      if (!isObject(level) || !isObject(level.deviceFilter)) continue;
      const attribute = String(level.attribute ?? "");
      // AdditiveBattleBooster shifts (`value`), FactorBattleBooster scales
      // (`factor`); the script class names it.
      const type: "mul" | "add" = cls.includes("Additive") ? "add" : "mul";
      const value = nums(type === "add" ? level.value : level.factor)[0];
      const effect =
        attribute && Number.isFinite(value)
          ? { attribute, type, value }
          : null;
      out.push({ key, icon, description, effect });
    }
    return out;
  }

  // Consumable script classes we surface (repair/first-aid kits, extinguishers,
  // food, fuel, ...); combat-reserve strikes (RageArtillery/Bomber) and dev
  // examples are excluded.
  static readonly #CONSUMABLE_CLASSES = new Set([
    "Repairkit",
    "Extinguisher",
    "Fuel",
    "RemovedRpmLimiter",
    "Afterburning",
    "Stimulator",
  ]);
  // The `<tags>` value that names a consumable's category (medkit and repairkit
  // share the `Repairkit` script class, so only the tag tells them apart).
  static readonly #CONSUMABLE_CATEGORY_TAGS = new Set([
    "repairkit",
    "medkit",
    "extinguisher",
    "fuel",
    "stimulator",
  ]);
  // Consumable script tags that change a displayed characteristic: the first four
  // are multiplicative factors; `crewLevelIncrease` is a flat crew-level bonus
  // (food/rations = +10) that the app feeds into the same crew-level mechanic as
  // Brothers in Arms and Improved Ventilation.
  static readonly #CONSUMABLE_EFFECT_TAGS = [
    "enginePowerFactor",
    "turretRotationSpeedFactor",
    "fireStartingChanceFactor",
    "maxSpeedFactor",
    "crewLevelIncrease",
  ];

  /** The consumables a vehicle can mount, from equipments.xml, filtered by the
   * vehicle's tags/tier/nation. */
  #consumables(
    parser: XMLParser,
    xml: string,
    tier: number,
    tags: Set<string>,
    nation: string,
  ): ConsumableDef[] {
    const root = this.#root(parser, xml);
    const out: ConsumableDef[] = [];
    for (const [key, item] of Object.entries(root)) {
      if (key === "xmlns:xmlref" || !isObject(item)) continue;
      const script = isObject(item.script) ? item.script : {};
      const cls = String(script["#text"] ?? "")
        .trim()
        .split(/\s+/)[0];
      if (!SourceEquipmentResource.#CONSUMABLE_CLASSES.has(cls)) continue;
      if (!this.#matches(item.vehicleFilter, tier, tags, nation)) continue;
      const effects: ConsumableEffect[] = [];
      for (const t of SourceEquipmentResource.#CONSUMABLE_EFFECT_TAGS) {
        const v = nums(script[t])[0];
        if (Number.isFinite(v)) effects.push({ attribute: t, value: v });
      }
      const category =
        tokens(item.tags).find((t) =>
          SourceEquipmentResource.#CONSUMABLE_CATEGORY_TAGS.has(t),
        ) ?? "";
      out.push({
        key,
        userString: String(item.userString ?? ""),
        description: String(item.description ?? item.shortDescriptionSpecial ?? ""),
        icon: iconName(item.icon),
        effects,
        category,
      });
    }
    return out;
  }

  #effects(device: XmlNode): EquipmentEffect[] {
    const script = isObject(device.script) ? device.script : {};
    const scriptClass = String(script["#text"] ?? "")
      .trim()
      .split(/\s+/)[0];
    const factors = isObject(script.factors) ? script.factors : {};
    const out = arr<XmlNode>(factors.factor)
      .map((f): EquipmentEffect | null => {
        const attribute = String(f.attribute ?? "");
        const type = String(f.type ?? "");
        if (!attribute || (type !== "mul" && type !== "add")) return null;
        const vals = nums(f.valueByLevel ?? f.value);
        if (vals.length === 0) return null;
        // valueByLevel = "<base> <bonus>"; a single value applies to both.
        return { attribute, type, base: vals[0], bonus: vals[vals.length - 1] };
      })
      .filter((e): e is EquipmentEffect => e !== null);

    // Several devices carry no standard `<factor>` block; their effect lives in a
    // dedicated script tag. Surface each under a stable synthetic attribute the
    // app maps to a characteristic.
    const mul = (v: unknown): [number, number] | null => {
      const n = nums(v);
      return n.length ? [n[0], n[n.length - 1]] : null;
    };
    // Grousers: `rotationFactor` scales terrain resistance (all three grounds).
    if (/Grousers/.test(scriptClass)) {
      const v = mul(script.rotationFactor);
      if (v) out.push({ attribute: "rotationFactor", type: "mul", base: v[0], bonus: v[1] });
    }
    // Stereoscope (Binocular Telescope): `circularVisionRadius` scales view range.
    if (/Stereoscope/.test(scriptClass)) {
      const v = mul(script.circularVisionRadius);
      if (v) out.push({ attribute: "circularVisionRadius", type: "mul", base: v[0], bonus: v[1] });
    }
    // Camo devices: an additive `invisibilityBonus` under `overridableFactors`.
    // A CamouflageNet only helps when stationary (still camo); a LowNoiseTracks
    // (low-noise exhaust) keeps working on the move (still + moving camo).
    const overridable = isObject(script.overridableFactors)
      ? script.overridableFactors
      : {};
    const camo = mul(overridable.invisibilityBonus);
    if (camo) {
      const attribute = /CamouflageNet/.test(scriptClass)
        ? "invisibilityStill"
        : "invisibilityAll";
      out.push({ attribute, type: "add", base: camo[0], bonus: camo[1] });
    }
    return out;
  }

  /** The equipment (optional device) slots a vehicle exposes, in order. A
   * vehicle has a fixed number of slots; `customRoleSlotOptions` does not add
   * one, it makes the first uncategorized slot *configurable* (the player can
   * set its category to one of the options, or leave it none). Any remaining
   * uncategorized slots stay generic. */
  #slots(veh: XmlNode, slotTypes: Map<number, SlotType>): EquipmentSlot[] {
    const roleOptions = nums(veh.customRoleSlotOptions)
      .map((id) => slotTypes.get(id)?.categories[0])
      .filter((c): c is string => !!c);

    const slots: EquipmentSlot[] = [];
    let roleAssigned = false;
    for (const id of nums(veh.supplySlots)) {
      const st = slotTypes.get(id);
      if (st?.type !== "optionalDevice") continue;
      const category = st.categories[0] ?? null;
      if (category === null && !roleAssigned && roleOptions.length > 0) {
        roleAssigned = true;
        slots.push({ category: null, role: true, roleOptions });
      } else {
        slots.push({ category, role: false });
      }
    }
    return slots;
  }

  async loadout(tankId: number): Promise<TankLoadout | null> {
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
    const common = "sources/res/scripts/item_defs/vehicles/common";
    const base = `sources/res/scripts/item_defs/vehicles/${nation}`;
    const [listXml, slotTypesXml, devicesXml, equipmentsXml] =
      await Promise.all([
        this.#text(rawUrl(branch, `${base}/list.xml`)),
        this.#text(rawUrl(branch, `${common}/supply_slot_types.xml`)),
        this.#text(rawUrl(branch, `${common}/optional_devices.xml`)),
        this.#text(rawUrl(branch, `${common}/equipments.xml`)),
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
    const tags = new Set(tokens(match.entry.tags));
    const slotTypes = this.#slotTypes(parser, slotTypesXml);

    const vehXml = await this.#text(rawUrl(branch, `${base}/${match.tag}.xml`));
    const veh = this.#root(parser, vehXml);
    const slots = this.#slots(veh, slotTypes);

    const devices = this.#root(parser, devicesXml);

    // The Equipment 2.0 category of a device family, keyed by the shared `<icon>`:
    // only the standard (credit) device carries `<categories>`, so its bond
    // variant (same icon) inherits the category from here.
    const categoryByIcon = new Map<string, string>();
    for (const device of Object.values(devices)) {
      if (!isObject(device)) continue;
      const cats = tokens(device.categories);
      const icon = iconName(device.icon);
      if (cats.length > 0 && icon && !categoryByIcon.has(icon))
        categoryByIcon.set(icon, cats[0]);
    }

    const equipment: EquipmentDef[] = [];
    for (const [key, device] of Object.entries(devices)) {
      if (key === "xmlns:xmlref" || !isObject(device)) continue;
      const dtags = tokens(device.tags);
      const cats = tokens(device.categories);
      let grade: EquipmentGrade;
      if (dtags.includes("deluxe")) grade = "bond";
      else if (dtags.includes("trophyUpgraded")) grade = "bountyUpgraded";
      else if (dtags.includes("trophyBasic")) grade = "bounty";
      else if (/^modernized/i.test(key) || dtags.some((t) => /^modernized_\d/.test(t)))
        grade = "experimental";
      else if (cats.length > 0) grade = "standard";
      else continue;
      if (!this.#matches(device.vehicleFilter, tier, tags, nation)) continue;
      const icon = iconName(device.icon);
      // Bond/bounty variants share their family's category (by icon);
      // experimental items are multi-family, so they carry none.
      const categories =
        cats.length > 0
          ? cats
          : grade !== "experimental" && categoryByIcon.has(icon)
            ? [categoryByIcon.get(icon)!]
            : [];
      const def: EquipmentDef = {
        key,
        userString: String(device.userString ?? ""),
        // Optional devices describe themselves via `<shortDescriptionSpecial>`
        // (`.../short_special`); consumables use `<description>` (`.../descr`).
        description: String(
          device.description ?? device.shortDescriptionSpecial ?? "",
        ),
        groupName: String(device.groupName ?? key),
        icon,
        grade,
        categories,
        effects: this.#effects(device),
      };
      // Experimental equipment ships as three upgrade levels (modernized_1/2/3)
      // of one device; keep them all so the UI can step through the levels.
      equipment.push(def);
    }

    // Keep every crew directive (they boost a skill, not a device) and only the
    // equipment directives whose enhanced device is in this vehicle's catalogue.
    const deviceIcons = new Set(equipment.map((e) => e.icon));
    const directives = this.#directives(parser, equipmentsXml).filter(
      (d) => d.skillName || deviceIcons.has(d.icon),
    );
    const consumables = this.#consumables(
      parser,
      equipmentsXml,
      tier,
      tags,
      nation,
    );

    // Resolve each device/consumable description from its `#artefacts:.../descr`
    // ref against the artefacts localization (one memoized fetch, multi-line
    // aware), turning the ref into the displayed description.
    const artefacts = await loadPo(branch, "artefacts", (url) => this.#text(url));
    const descr = (ref: string): string =>
      ref.startsWith("#artefacts:")
        ? (artefacts.get(ref.slice("#artefacts:".length)) ?? "")
        : "";
    for (const e of equipment) e.description = descr(e.description);
    for (const c of consumables) c.description = descr(c.description);
    for (const dir of directives) dir.description = descr(dir.description);
    // A bond/special variant (its own name, e.g. "Venting System") often has an
    // empty description key; fall back to the standard device of the same family
    // (shared `<icon>`), whose description it mirrors in game.
    const descByIcon = new Map<string, string>();
    for (const e of equipment)
      if (e.description && e.icon && !descByIcon.has(e.icon))
        descByIcon.set(e.icon, e.description);
    for (const e of equipment)
      if (!e.description && e.icon)
        e.description = descByIcon.get(e.icon) ?? "";

    return { tankId, tag: match.tag, slots, equipment, directives, consumables };
  }
}
