import type { TankSpec } from "../db/schema/tank-specs";
import { MIRROR_TRACKING_START } from "./mirror-tracking";

/**
 * The oldest game version the spec-history backfill covers. A tank already
 * present then predates our tracking, so its real introduction date is unknown:
 * all we can say is it was introduced *before* that update. The UI uses this to
 * label such tanks instead of showing an empty History tab.
 */
export const TANK_HISTORY_TRACKING_START = MIRROR_TRACKING_START;

/**
 * Whether a higher value is better for a spec, so a change can be coloured a
 * buff or a nerf. `Neutral` never colours (a caliber or gun-arc change follows
 * the gun, it is not an improvement in itself).
 */
export enum SpecDirection {
  HigherBetter = "higher",
  LowerBetter = "lower",
  Neutral = "neutral",
}

/** How to display and colour one tracked value, independent of where it comes
 * from (a base spec field or a synthesized per-shell stat). */
export type FieldDescriptor = {
  label: string;
  unit?: string;
  /** Fixed decimals when displaying (undefined = integer). Also the precision at
   * which the diff decides a value "changed", so a recorded change is exactly a
   * change the reader can see. */
  digits?: number;
  /** Multiplier from the stored value to the displayed one (fire chance and camo
   * are stored 0..1 and shown as %, weight is stored in kg and shown in t). */
  scale?: number;
  direction: SpecDirection;
};

/**
 * The aspects a vehicle is read along. Direction says whether a value is good,
 * this says what it is *about*, which is what lets a reader be told that two
 * tanks are close on mobility and far apart on armour rather than handed one
 * undifferentiated number.
 *
 * Six axes rather than the four the specifications table groups by: gun
 * handling is split out of firepower, because a gun's accuracy and its damage
 * describe two different tanks, concealment is named rather than left in an
 * "other" bucket, since it is half of what separates a scout from a brawler,
 * and playstyle sits alongside them. That last one is carried by no spec
 * column: it comes from how the tank is actually played on the server
 * (`tank_stats`), which is the one thing a datasheet cannot say.
 */
export enum TankAxis {
  Firepower = "firepower",
  GunHandling = "gun-handling",
  Mobility = "mobility",
  Survivability = "survivability",
  Concealment = "concealment",
  Playstyle = "playstyle",
}

/** Display label for an axis. */
export const TANK_AXIS_LABEL: Record<TankAxis, string> = {
  [TankAxis.Firepower]: "Firepower",
  [TankAxis.GunHandling]: "Gun handling",
  [TankAxis.Mobility]: "Mobility",
  [TankAxis.Survivability]: "Survivability",
  [TankAxis.Concealment]: "Concealment",
  [TankAxis.Playstyle]: "Playstyle",
};

/** The axes in the order they are read, firepower first and playstyle last
 * (it is the one that can be missing, on a tank too rarely played to average). */
export const TANK_AXES: TankAxis[] = [
  TankAxis.Firepower,
  TankAxis.GunHandling,
  TankAxis.Mobility,
  TankAxis.Survivability,
  TankAxis.Concealment,
  TankAxis.Playstyle,
];

export type TrackedSpecField = FieldDescriptor & {
  /** The `tank_specs` column this reads. */
  key: keyof TankSpec & string;
  /** Which aspect of the vehicle it describes. Required, so a characteristic
   * added to the tracking cannot silently land outside every axis. Never
   * `Playstyle`: no spec column describes how a tank is played. */
  axis: Exclude<TankAxis, TankAxis.Playstyle>;
};

/** Marks a tracked key as a tier-XI special-ability parameter (from a vehicle's
 * `<mechanics>` block) rather than a base spec field, in both the snapshot data
 * and `tank_changes.field`. Shared so the diff (core) and the display (front)
 * agree on the convention. */
export const MECHANICS_PREFIX = "mechanics:";

const HB = SpecDirection.HigherBetter;
const LB = SpecDirection.LowerBetter;
const NEUTRAL = SpecDirection.Neutral;

const FP = TankAxis.Firepower;
const GH = TankAxis.GunHandling;
const MOB = TankAxis.Mobility;
const SURV = TankAxis.Survivability;
const CON = TankAxis.Concealment;

/**
 * The spec fields whose changes across game versions are worth telling a player
 * about: firepower, gun handling, mobility, survivability and concealment, at
 * the same labels, units and buff/nerf direction the specifications table uses.
 * This is the single source both the diff cron and the changelog UI read, so
 * "what counts as a change" and "how it is shown" never drift apart.
 *
 * Module HP, economics and tech-tree links are deliberately left out: they move
 * rarely and would only be noise in a patch-notes stream.
 */
export const TRACKED_SPEC_FIELDS: TrackedSpecField[] = [
  // Firepower. Per-shell stats (damage, penetration, penetration at 500m, shell
  // velocity, splash) are NOT here: they are the first shell only and ambiguous,
  // so they are tracked per shell instead (SHELL_STATS below), labelled by shell
  // type. Module damage stays (the mirror has no per-shell module damage).
  { key: "moduleDamage", axis: FP, label: "Module damage", unit: "hp", direction: HB },
  { key: "dpm", axis: FP, label: "DPM", direction: HB },
  { key: "reload", axis: FP, label: "Reload", unit: "s", digits: 2, direction: LB },
  { key: "intraClipReload", axis: FP, label: "Intra-clip reload", unit: "s", digits: 2, direction: LB },
  { key: "clipSize", axis: FP, label: "Clip size", direction: NEUTRAL },
  { key: "rof", axis: FP, label: "Rate of fire", unit: "/min", digits: 2, direction: HB },
  { key: "aimTime", axis: GH, label: "Aim time", unit: "s", digits: 2, direction: LB },
  { key: "accuracy", axis: GH, label: "Dispersion", unit: "m", digits: 3, direction: LB },
  { key: "dispMoving", axis: GH, label: "Dispersion moving", digits: 3, direction: LB },
  { key: "dispTankTraverse", axis: GH, label: "Dispersion on hull traverse", digits: 3, direction: LB },
  { key: "dispTurretTraverse", axis: GH, label: "Dispersion on turret traverse", digits: 3, direction: LB },
  { key: "dispAfterShot", axis: GH, label: "Dispersion after firing", unit: "×", digits: 2, direction: LB },
  { key: "dispWhileDamaged", axis: GH, label: "Dispersion, gun damaged", unit: "×", digits: 2, direction: LB },
  { key: "maxRange", axis: FP, label: "Max range", unit: "m", direction: NEUTRAL },
  { key: "caliber", axis: FP, label: "Caliber", unit: "mm", direction: NEUTRAL },
  { key: "ammoCapacity", axis: FP, label: "Ammo capacity", direction: NEUTRAL },
  { key: "depression", axis: GH, label: "Gun depression", unit: "°", direction: HB },
  { key: "elevation", axis: GH, label: "Gun elevation", unit: "°", direction: HB },
  { key: "gunArc", axis: GH, label: "Gun traverse range", unit: "°", direction: NEUTRAL },
  // Mobility
  { key: "speedForward", axis: MOB, label: "Top speed", unit: "km/h", direction: HB },
  { key: "speedBackward", axis: MOB, label: "Reverse speed", unit: "km/h", direction: HB },
  { key: "enginePower", axis: MOB, label: "Engine power", unit: "hp", direction: HB },
  { key: "powerWeight", axis: MOB, label: "Power/weight", unit: "hp/t", digits: 1, direction: HB },
  { key: "hullTraverse", axis: MOB, label: "Hull traverse", unit: "°/s", digits: 1, direction: HB },
  { key: "turretTraverse", axis: MOB, label: "Turret traverse", unit: "°/s", digits: 1, direction: HB },
  { key: "terrainHard", axis: MOB, label: "Terrain resistance, hard", digits: 2, direction: LB },
  { key: "terrainMedium", axis: MOB, label: "Terrain resistance, medium", digits: 2, direction: LB },
  { key: "terrainSoft", axis: MOB, label: "Terrain resistance, soft", digits: 2, direction: LB },
  // Survivability
  { key: "health", axis: SURV, label: "Hit points", unit: "hp", direction: HB },
  { key: "engineFireChance", axis: SURV, label: "Fire chance", unit: "%", digits: 1, scale: 100, direction: LB },
  { key: "hullArmorFront", axis: SURV, label: "Hull armor, front", unit: "mm", direction: HB },
  { key: "hullArmorSide", axis: SURV, label: "Hull armor, side", unit: "mm", direction: HB },
  { key: "hullArmorRear", axis: SURV, label: "Hull armor, rear", unit: "mm", direction: HB },
  { key: "turretArmorFront", axis: SURV, label: "Turret armor, front", unit: "mm", direction: HB },
  { key: "turretArmorSide", axis: SURV, label: "Turret armor, side", unit: "mm", direction: HB },
  { key: "turretArmorRear", axis: SURV, label: "Turret armor, rear", unit: "mm", direction: HB },
  { key: "trackArmor", axis: SURV, label: "Track armor", unit: "mm", direction: HB },
  { key: "trackRepairTime", axis: SURV, label: "Track repair time", unit: "s", digits: 2, direction: LB },
  // Spotting & concealment
  { key: "viewRange", axis: CON, label: "View range", unit: "m", direction: HB },
  { key: "radioRange", axis: CON, label: "Signal range", unit: "m", direction: HB },
  { key: "camoStill", axis: CON, label: "Camouflage, stationary", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoMoving", axis: CON, label: "Camouflage, moving", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoStillFiring", axis: CON, label: "Camouflage, stationary after firing", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoMovingFiring", axis: CON, label: "Camouflage, moving after firing", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "weight", axis: MOB, label: "Weight", unit: "t", digits: 1, scale: 0.001, direction: LB },
];

/** The tracked field keys, in display order. */
export const TRACKED_SPEC_FIELD_KEYS: (keyof TankSpec & string)[] =
  TRACKED_SPEC_FIELDS.map((f) => f.key);

/** Lookup a tracked field by its `tank_specs` key. */
export const TRACKED_SPEC_FIELD_MAP: Record<string, TrackedSpecField> =
  Object.fromEntries(TRACKED_SPEC_FIELDS.map((f) => [f.key, f]));

/**
 * The displayed value of a raw stored spec value for a field: applies the
 * field's scale then rounds to its display precision. The diff uses this to
 * decide a change happened (so it matches exactly what the reader sees), and
 * the UI uses it to render. Returns null when the value is missing.
 */
export function displaySpecValue(
  field: FieldDescriptor,
  raw: number | null | undefined,
): number | null {
  if (typeof raw !== "number") return null;
  const scaled = raw * (field.scale ?? 1);
  const d = field.digits ?? 0;
  return Number(scaled.toFixed(d));
}

/** Marks a tracked key as a per-shell firepower stat, `shell:<index>:<type>:<stat>`
 * (e.g. `shell:1:APCR:penetration`). The index keeps two shells of the same type
 * distinct for diffing; the type is the display label. */
export const SHELL_PREFIX = "shell:";

/** The firepower stats tracked per shell, with where each reads from a wot-src
 * `shellStats[]` entry and how it displays. All higher-is-better. */
export const SHELL_STATS: {
  /** The `tank_specs` column the stat reads on a first-shell basis. Typed as a
   * real column so the similarity profile can derive its firepower fields from
   * this list without a cast, and a typo here is a compile error. */
  stat: keyof TankSpec & string;
  from: string;
  label: string;
  unit?: string;
  digits?: number;
}[] = [
  { stat: "damage", from: "damage", label: "Damage", unit: "hp" },
  { stat: "penetration", from: "pen", label: "Penetration", unit: "mm" },
  { stat: "penetration500", from: "pen500", label: "Penetration at 500m", unit: "mm" },
  { stat: "shellVelocity", from: "velocity", label: "Shell velocity", unit: "m/s" },
  { stat: "splashRadius", from: "splash", label: "Splash radius", unit: "m", digits: 2 },
];

const SHELL_STAT_MAP: Record<string, (typeof SHELL_STATS)[number]> =
  Object.fromEntries(SHELL_STATS.map((s) => [s.stat, s]));

/** Friendly short code for a raw WG shell kind. A stable WG taxonomy; an unknown
 * or new kind falls back to its raw name rather than break. Shared so the ammo
 * panel and the changes feed label shells the same. */
export const SHELL_LABEL: Record<string, string> = {
  ARMOR_PIERCING: "AP",
  ARMOR_PIERCING_CR: "APCR",
  ARMOR_PIERCING_HE: "AP-HE",
  HOLLOW_CHARGE: "HEAT",
  HIGH_EXPLOSIVE: "HE",
};

/**
 * Resolve a tracked key to a display descriptor, whatever its class: a base spec
 * field, or a per-shell firepower stat (`shell:<i>:<type>:<stat>` → labelled
 * "<Stat> · <TYPE>", higher-better). Returns null for a key with no descriptor
 * (an ability `mechanics:` param, which renders neutral, or an unknown field).
 * Shared by the diff (to compare at display precision) and the UI (to render).
 */
export function resolveTrackedField(key: string): FieldDescriptor | null {
  if (key.startsWith(SHELL_PREFIX)) {
    const parts = key.split(":"); // ["shell", index, type, stat]
    const type = parts[2];
    const meta = SHELL_STAT_MAP[parts[3]];
    if (!type || !meta) return null;
    return {
      label: `${meta.label} · ${SHELL_LABEL[type] ?? type}`,
      unit: meta.unit,
      digits: meta.digits,
      direction: SpecDirection.HigherBetter,
    };
  }
  return TRACKED_SPEC_FIELD_MAP[key] ?? null;
}
