import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { fetchNations } from "./nations";
import {
  BRANCH_BY_REGION,
  computeTankId,
  rawUrl,
  VEHICLE_TYPES,
  WotSrcBranch,
} from "./mirror";

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
  // firepower
  damage: number | null;
  moduleDamage: number | null;
  splashRadius: number | null;
  reload: number | null;
  rof: number | null;
  intraClipReload: number | null;
  dpm: number | null;
  penetration: number | null;
  caliber: number | null;
  shellVelocity: number | null;
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
  turretArmorFront: number | null;
  trackArmor: number | null;
  trackHealth: number | null;
  trackRepairTime: number | null;
  ammoRackHealth: number | null;
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
};

type XmlNode = Record<string, unknown>;


function isObject(v: unknown): v is XmlNode {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * WoT XML leaves that carry a `<!--BW_String-->` comment are parsed as their
 * text value (comments are stripped by the parser config), so most numeric
 * leaves are plain strings. Some, however, are objects wrapping a `#text` (when
 * a leaf also has child elements). Read either shape as a number.
 */
function num(v: unknown): number | null {
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
function numList(v: unknown): number[] {
  if (v == null) return [];
  const s = typeof v === "object" && isObject(v) && "#text" in v ? String(v["#text"]) : String(v);
  return s
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n));
}

/** Whitespace-separated string tokens of a string leaf. */
function tokens(v: unknown): string[] {
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
function moduleKeys(slot: unknown): string[] {
  if (!isObject(slot)) return [];
  return Object.keys(slot).filter((k) => k !== "shared");
}
function topModuleKey(slot: unknown): string | null {
  const keys = moduleKeys(slot);
  return keys.length ? keys[keys.length - 1] : null;
}

/**
 * Resolve a module to its full definition. `inline` is the vehicle-file block
 * (may be the literal string `"shared"`, or a partial object of overrides).
 * `sharedDef` is the component-file definition (or undefined). The result is a
 * deep-merge with vehicle-inline fields winning.
 */
function resolveModule(inline: unknown, sharedDef: unknown): XmlNode | null {
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
    const res = await this.t.get(new URL(url), { limit: RateLimit.None });
    return res.text();
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
        const spec = this.#derive(
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

  #derive(
    tankId: number,
    tag: string,
    root: XmlNode,
    shared: {
      guns: XmlNode;
      shells: XmlNode;
      turrets: XmlNode;
      engines: XmlNode;
      chassis: XmlNode;
      radios: XmlNode;
      fuelTanks: XmlNode;
    },
    listEntry: XmlNode,
  ): WotSrcSpec {
    const { m } = this.#resolveModules(root, shared);
    return this.#computeSpec(tankId, tag, root, listEntry, shared, m);
  }

  /**
   * Resolve one module per slot to its full (shared-merged) definition. With no
   * `sel`, every slot takes its TOP module (the stock top-config, byte-identical
   * to the former inline resolution). `sel` overrides individual slots by key so
   * the per-config enumeration can walk every combination. The gun lives under
   * the *resolved* turret (`T.guns`), so its key is looked up after the turret.
   */
  #resolveModules(
    root: XmlNode,
    shared: {
      guns: XmlNode;
      shells: XmlNode;
      turrets: XmlNode;
      engines: XmlNode;
      chassis: XmlNode;
      radios: XmlNode;
      fuelTanks: XmlNode;
    },
    sel?: {
      chassisKey?: string;
      turretKey?: string;
      gunKey?: string;
      engineKey?: string;
      radioKey?: string;
      fuelKey?: string;
    },
  ): {
    m: { hull: XmlNode; C: XmlNode; T: XmlNode; G: XmlNode; E: XmlNode; R: XmlNode; F: XmlNode };
    keys: {
      chassis: string | null;
      turret: string | null;
      gun: string | null;
      engine: string | null;
      radio: string | null;
      fuel: string | null;
    };
  } {
    const hull = isObject(root.hull) ? root.hull : {};

    const chassisSlot = root.chassis;
    const chassisKey = sel?.chassisKey ?? topModuleKey(chassisSlot);
    const chassisInline =
      chassisKey && isObject(chassisSlot) ? chassisSlot[chassisKey] : undefined;
    const C =
      resolveModule(chassisInline, chassisKey ? shared.chassis[chassisKey] : undefined) ?? {};

    const turretSlot = root.turrets0;
    const turretKey = sel?.turretKey ?? topModuleKey(turretSlot);
    const turretInline =
      turretKey && isObject(turretSlot) ? turretSlot[turretKey] : undefined;
    const T =
      resolveModule(turretInline, turretKey ? shared.turrets[turretKey] : undefined) ?? {};

    const gunsSlot = isObject(T) ? (T as XmlNode).guns : undefined;
    const gunKey = sel?.gunKey ?? topModuleKey(gunsSlot);
    const gunInline = gunKey && isObject(gunsSlot) ? (gunsSlot as XmlNode)[gunKey] : undefined;
    const G = resolveModule(gunInline, gunKey ? shared.guns[gunKey] : undefined) ?? {};

    const engineKey = sel?.engineKey ?? topModuleKey(root.engines);
    const engineInline =
      engineKey && isObject(root.engines) ? (root.engines as XmlNode)[engineKey] : undefined;
    const E =
      resolveModule(engineInline, engineKey ? shared.engines[engineKey] : undefined) ?? {};

    const radioKey = sel?.radioKey ?? topModuleKey(root.radios);
    const radioInline =
      radioKey && isObject(root.radios) ? (root.radios as XmlNode)[radioKey] : undefined;
    const R =
      resolveModule(radioInline, radioKey ? shared.radios[radioKey] : undefined) ?? {};

    const fuelKey = sel?.fuelKey ?? topModuleKey(root.fuelTanks);
    const fuelInline =
      fuelKey && isObject(root.fuelTanks) ? (root.fuelTanks as XmlNode)[fuelKey] : undefined;
    const F =
      resolveModule(fuelInline, fuelKey ? shared.fuelTanks[fuelKey] : undefined) ?? {};

    return {
      m: { hull, C, T, G, E, R, F },
      keys: {
        chassis: chassisKey,
        turret: turretKey,
        gun: gunKey,
        engine: engineKey,
        radio: radioKey,
        fuel: fuelKey,
      },
    };
  }

  /** The full derived stat block from an already-resolved set of modules (one
   * per slot). Shared by the top-config `#derive` and the per-config
   * enumeration below, so both produce identical numbers. */
  #computeSpec(
    tankId: number,
    tag: string,
    root: XmlNode,
    listEntry: XmlNode,
    shared: {
      guns: XmlNode;
      shells: XmlNode;
      turrets: XmlNode;
      engines: XmlNode;
      chassis: XmlNode;
      radios: XmlNode;
      fuelTanks: XmlNode;
    },
    m: {
      hull: XmlNode;
      C: XmlNode;
      T: XmlNode;
      G: XmlNode;
      E: XmlNode;
      R: XmlNode;
      F: XmlNode;
    },
  ): WotSrcSpec {
    const { hull, C, T, G, E, R, F } = m;
    // --- default shell + shot on the gun ---
    const shots = isObject(G.shots) ? (G.shots as XmlNode) : {};
    const shotEntries = Object.entries(shots).filter(([, v]) => isObject(v)) as [string, XmlNode][];
    let defaultShot: [string, XmlNode] | undefined = shotEntries[0];
    let bestPortion = -1;
    for (const [name, shot] of shotEntries) {
      const p = num((shot as XmlNode).defaultPortion) ?? 0;
      if (p > bestPortion) {
        bestPortion = p;
        defaultShot = [name, shot];
      }
    }
    const shot = defaultShot?.[1] ?? {};
    const shellName = defaultShot?.[0];
    const shell =
      shellName && isObject(shared.shells[shellName]) ? (shared.shells[shellName] as XmlNode) : {};

    // --- economics ---
    // list.xml price is a plain string (credits) for tech-tree tanks, or an
    // object `{ gold, #text }` for premiums (gold price). Shell cost is the
    // default shell's price; full ammo cost = shell cost * gun capacity.
    const priceNode = listEntry.price;
    let buyCredits: number | null = null;
    let buyGold: number | null = null;
    if (typeof priceNode === "string") {
      buyCredits = num(priceNode);
    } else if (isObject(priceNode)) {
      // A `<gold/>` flag element means the amount in `#text` is gold (premium);
      // otherwise it is a credit price.
      if ("gold" in priceNode) buyGold = num(priceNode["#text"]);
      else buyCredits = num(priceNode["#text"]);
    }
    const shellCost = num(shell.price);
    const maxAmmo = num(G.maxAmmo);
    const ammoCost =
      shellCost != null && maxAmmo != null ? shellCost * maxAmmo : null;

    // --- firepower ---
    const dmgNode = isObject(shell.damage) ? (shell.damage as XmlNode) : {};
    const damage = num(dmgNode.armor);
    const moduleDamage = num(dmgNode.devices);
    const splashRadius = num(shell.explosionRadius);
    const caliber = num(shell.caliber) ?? num(shot.caliber);
    const penetration = firstNum(shot.piercingPower);
    const shellVelocity = num(shot.speed);

    const reload = num(G.reloadTime);
    const clip = isObject(G.clip) ? (G.clip as XmlNode) : null;
    let rof: number | null = null;
    let dpm: number | null = null;
    let intraClipReload: number | null = null;
    if (clip && reload != null && damage != null) {
      const count = num(clip.count) ?? 0;
      const rate = num(clip.rate) ?? 0; // intra-clip shots per minute
      if (count > 0 && rate > 0) {
        intraClipReload = 60 / rate;
        const cycleTime = ((count - 1) / rate) * 60 + reload;
        rof = (count / cycleTime) * 60;
        dpm = (count * damage * 60) / cycleTime;
      }
    } else if (reload != null && reload > 0 && damage != null) {
      rof = 60 / reload;
      dpm = rof * damage;
    }

    // --- gun handling ---
    const accuracy = num(G.shotDispersionRadius);
    const aimTime = num(G.aimingTime);
    const gunDisp = isObject(G.shotDispersionFactors) ? (G.shotDispersionFactors as XmlNode) : {};
    const dispTurretTraverse = num(gunDisp.turretRotation);
    const dispAfterShot = num(gunDisp.afterShot);
    const dispWhileDamaged = num(gunDisp.whileGunDamaged);
    const chassisDisp = isObject(C.shotDispersionFactors)
      ? (C.shotDispersionFactors as XmlNode)
      : {};
    const dispMoving = num(chassisDisp.vehicleMovement);
    const dispTankTraverse = num(chassisDisp.vehicleRotation);

    // gun arc: limited yaw → span in degrees; otherwise full 360.
    let gunArc: number | null = 360;
    const yaw = numList(G.turretYawLimits);
    if (yaw.length >= 2) {
      const span = Math.abs(yaw[1] - yaw[0]);
      // -180 180 (or wider) is effectively full traverse.
      gunArc = span >= 359 ? 360 : span;
    }

    // pitch limits: "yaw angle yaw angle …" pairs; angles are the odd positions.
    const pitch = isObject(G.pitchLimits) ? (G.pitchLimits as XmlNode) : {};
    const minAngles = numList(pitch.minPitch).filter((_, i) => i % 2 === 1);
    const maxAngles = numList(pitch.maxPitch).filter((_, i) => i % 2 === 1);
    const depression = minAngles.length ? -Math.min(...minAngles) : null;
    const elevation = maxAngles.length ? Math.max(...maxAngles) : null;

    // --- mobility ---
    const speeds = isObject(root.speedLimits) ? (root.speedLimits as XmlNode) : {};
    const speedForward = num(speeds.forward);
    const speedBackward = num(speeds.backward);
    const hullTraverse = num(C.rotationSpeed);
    const turretTraverse = num(T.rotationSpeed);
    const enginePower = num(E.power);
    const terrain = numList(C.terrainResistance);
    const terrainHard = terrain[0] ?? null;
    const terrainMedium = terrain[1] ?? null;
    const terrainSoft = terrain[2] ?? null;

    // weight = sum of module weights (kg).
    const weightParts = [
      num(hull.weight),
      num(C.weight),
      num(T.weight),
      num(G.weight),
      num(E.weight),
      num(R.weight),
      num(F.weight),
    ].filter((n): n is number => n != null);
    const weight = weightParts.length ? weightParts.reduce((a, b) => a + b, 0) : null;
    const powerWeight = enginePower != null && weight ? enginePower / (weight / 1000) : null;

    // --- survivability ---
    const health = num(hull.maxHealth);
    const engineHealth = num(E.maxHealth);
    const engineFireChance = num(E.fireStartingChance);

    const hullArmor = isObject(hull.armor) ? (hull.armor as XmlNode) : {};
    const hullPrimary = tokens(hull.primaryArmor);
    const hullArmorFront = hullPrimary.length ? num(hullArmor[hullPrimary[0]]) : null;

    const turretArmor = isObject(T.armor) ? (T.armor as XmlNode) : {};
    const turretPrimary = tokens(T.primaryArmor);
    const turretArmorFrontRaw = turretPrimary.length ? num(turretArmor[turretPrimary[0]]) : null;
    const turretArmorFront =
      turretArmorFrontRaw && turretArmorFrontRaw > 0 ? turretArmorFrontRaw : null;

    const chassisArmor = isObject(C.armor) ? (C.armor as XmlNode) : {};
    const trackArmor = num(chassisArmor.leftTrack);
    const trackHealth = num(C.maxHealth);
    const ammoBay = isObject(hull.ammoBayHealth) ? (hull.ammoBayHealth as XmlNode) : {};
    const ammoRackHealth = num(ammoBay.maxHealth);

    // --- other ---
    const viewRange = num(T.circularVisionRadius);
    const radioRange = num(R.distance);

    const invis = isObject(root.invisibility) ? (root.invisibility as XmlNode) : {};
    const camoStill = num(invis.still);
    const camoMoving = num(invis.moving);
    const firePenalty = num(invis.firePenalty) ?? 0;
    const camoStillFiring = camoStill != null ? camoStill * (1 - firePenalty) : null;
    const camoMovingFiring = camoMoving != null ? camoMoving * (1 - firePenalty) : null;

    return {
      tankId,
      tag,
      damage,
      moduleDamage,
      splashRadius,
      reload,
      rof,
      intraClipReload,
      dpm,
      penetration,
      caliber,
      shellVelocity,
      accuracy,
      aimTime,
      dispMoving,
      dispTankTraverse,
      dispTurretTraverse,
      dispAfterShot,
      dispWhileDamaged,
      gunArc,
      depression,
      elevation,
      speedForward,
      speedBackward,
      hullTraverse,
      turretTraverse,
      enginePower,
      powerWeight,
      terrainHard,
      terrainMedium,
      terrainSoft,
      health,
      engineHealth,
      engineFireChance,
      hullArmorFront,
      turretArmorFront,
      trackArmor,
      trackHealth,
      trackRepairTime: null,
      ammoRackHealth,
      weight,
      viewRange,
      radioRange,
      camoStill,
      camoMoving,
      camoStillFiring,
      camoMovingFiring,
      buyCredits,
      buyGold,
      shellCost,
      ammoCost,
    };
  }

  /**
   * Every valid module combination for one tank, each fully derived. Fetches the
   * one nation's shared component files plus the tank's own XML, then walks the
   * cartesian product of chassis x turret x (that turret's guns) x engine x
   * radio. `tankId` is decoded to (nationIdx, localId) with the same bit layout
   * `computeTankId` produces, so the caller only needs the numeric id.
   */
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
    const configs = this.#deriveConfigs(tankId, match.tag, root, shared, match.entry);
    return { tankId, tag: match.tag, configs };
  }

  /** Walk every module combination and derive its stat block. */
  #deriveConfigs(
    tankId: number,
    tag: string,
    root: XmlNode,
    shared: {
      guns: XmlNode;
      shells: XmlNode;
      turrets: XmlNode;
      engines: XmlNode;
      chassis: XmlNode;
      radios: XmlNode;
      fuelTanks: XmlNode;
    },
    listEntry: XmlNode,
  ): WotSrcConfig[] {
    const chassisKeys = moduleKeys(root.chassis);
    const turretKeys = moduleKeys(root.turrets0);
    const engineKeys = moduleKeys(root.engines);
    const radioKeys = moduleKeys(root.radios);
    const out: WotSrcConfig[] = [];

    for (const turretKey of turretKeys) {
      // Guns are nested under the resolved turret, so the gun key set depends on
      // which turret is mounted.
      const turretInline = isObject(root.turrets0)
        ? (root.turrets0 as XmlNode)[turretKey]
        : undefined;
      const T0 = resolveModule(turretInline, shared.turrets[turretKey]) ?? {};
      const gunKeys = moduleKeys(isObject(T0) ? (T0 as XmlNode).guns : undefined);

      for (const gunKey of gunKeys)
        for (const chassisKey of chassisKeys)
          for (const engineKey of engineKeys)
            for (const radioKey of radioKeys) {
              const { m } = this.#resolveModules(root, shared, {
                chassisKey,
                turretKey,
                gunKey,
                engineKey,
                radioKey,
              });
              const spec = this.#computeSpec(tankId, tag, root, listEntry, shared, m);
              out.push({
                keys: {
                  chassis: chassisKey,
                  turret: turretKey,
                  gun: gunKey,
                  engine: engineKey,
                  radio: radioKey,
                },
                spec,
              });
            }
    }
    return out;
  }
}
