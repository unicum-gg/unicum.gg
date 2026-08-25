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

export type TrackedSpecField = FieldDescriptor & {
  /** The `tank_specs` column this reads. */
  key: keyof TankSpec & string;
};

/** Marks a tracked key as a tier-XI special-ability parameter (from a vehicle's
 * `<mechanics>` block) rather than a base spec field, in both the snapshot data
 * and `tank_changes.field`. Shared so the diff (core) and the display (front)
 * agree on the convention. */
export const MECHANICS_PREFIX = "mechanics:";

const HB = SpecDirection.HigherBetter;
const LB = SpecDirection.LowerBetter;
const NEUTRAL = SpecDirection.Neutral;

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
  { key: "moduleDamage", label: "Module damage", unit: "hp", direction: HB },
  { key: "dpm", label: "DPM", direction: HB },
  { key: "reload", label: "Reload", unit: "s", digits: 2, direction: LB },
  { key: "intraClipReload", label: "Intra-clip reload", unit: "s", digits: 2, direction: LB },
  { key: "clipSize", label: "Clip size", direction: NEUTRAL },
  { key: "rof", label: "Rate of fire", unit: "/min", digits: 2, direction: HB },
  { key: "aimTime", label: "Aim time", unit: "s", digits: 2, direction: LB },
  { key: "accuracy", label: "Dispersion", unit: "m", digits: 3, direction: LB },
  { key: "dispMoving", label: "Dispersion moving", digits: 3, direction: LB },
  { key: "dispTankTraverse", label: "Dispersion on hull traverse", digits: 3, direction: LB },
  { key: "dispTurretTraverse", label: "Dispersion on turret traverse", digits: 3, direction: LB },
  { key: "dispAfterShot", label: "Dispersion after firing", unit: "×", digits: 2, direction: LB },
  { key: "dispWhileDamaged", label: "Dispersion, gun damaged", unit: "×", digits: 2, direction: LB },
  { key: "maxRange", label: "Max range", unit: "m", direction: NEUTRAL },
  { key: "caliber", label: "Caliber", unit: "mm", direction: NEUTRAL },
  { key: "ammoCapacity", label: "Ammo capacity", direction: NEUTRAL },
  { key: "depression", label: "Gun depression", unit: "°", direction: HB },
  { key: "elevation", label: "Gun elevation", unit: "°", direction: HB },
  { key: "gunArc", label: "Gun traverse range", unit: "°", direction: NEUTRAL },
  // Mobility
  { key: "speedForward", label: "Top speed", unit: "km/h", direction: HB },
  { key: "speedBackward", label: "Reverse speed", unit: "km/h", direction: HB },
  { key: "enginePower", label: "Engine power", unit: "hp", direction: HB },
  { key: "powerWeight", label: "Power/weight", unit: "hp/t", digits: 1, direction: HB },
  { key: "hullTraverse", label: "Hull traverse", unit: "°/s", digits: 1, direction: HB },
  { key: "turretTraverse", label: "Turret traverse", unit: "°/s", digits: 1, direction: HB },
  { key: "terrainHard", label: "Terrain resistance, hard", digits: 2, direction: LB },
  { key: "terrainMedium", label: "Terrain resistance, medium", digits: 2, direction: LB },
  { key: "terrainSoft", label: "Terrain resistance, soft", digits: 2, direction: LB },
  // Survivability
  { key: "health", label: "Hit points", unit: "hp", direction: HB },
  { key: "engineFireChance", label: "Fire chance", unit: "%", digits: 1, scale: 100, direction: LB },
  { key: "hullArmorFront", label: "Hull armor, front", unit: "mm", direction: HB },
  { key: "hullArmorSide", label: "Hull armor, side", unit: "mm", direction: HB },
  { key: "hullArmorRear", label: "Hull armor, rear", unit: "mm", direction: HB },
  { key: "turretArmorFront", label: "Turret armor, front", unit: "mm", direction: HB },
  { key: "turretArmorSide", label: "Turret armor, side", unit: "mm", direction: HB },
  { key: "turretArmorRear", label: "Turret armor, rear", unit: "mm", direction: HB },
  { key: "trackArmor", label: "Track armor", unit: "mm", direction: HB },
  { key: "trackRepairTime", label: "Track repair time", unit: "s", digits: 2, direction: LB },
  // Spotting & concealment
  { key: "viewRange", label: "View range", unit: "m", direction: HB },
  { key: "radioRange", label: "Signal range", unit: "m", direction: HB },
  { key: "camoStill", label: "Camouflage, stationary", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoMoving", label: "Camouflage, moving", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoStillFiring", label: "Camouflage, stationary after firing", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "camoMovingFiring", label: "Camouflage, moving after firing", unit: "%", digits: 1, scale: 100, direction: HB },
  { key: "weight", label: "Weight", unit: "t", digits: 1, scale: 0.001, direction: LB },
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
  stat: string;
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
