import type { TankSpec } from "@unicum.gg/shared";
import type { Currency } from "@/components/tanks/currency-icon";

export type Row = {
  // A row reads either a stored spec field (`key`) or a value derived from
  // several fields (`compute`), e.g. effective speed on a terrain.
  key?: keyof TankSpec;
  // `baseline` is the stock spec, for stats that scale relative to it (effective
  // traverse uses its weight and engine power).
  compute?: (specs: TankSpec, baseline: TankSpec | null) => number | null;
  label: string;
  unit?: string;
  digits?: number;
  scale?: number;
  // Direction of "better" when comparing configurations: values default to
  // higher-is-better; `lowerBetter` flips it (reload, weight, terrain
  // resistance, ...); `neutral` never colours (caliber changes with the gun but
  // is not strictly an improvement).
  lowerBetter?: boolean;
  neutral?: boolean;
  // A label-only sub-heading (no value), grouping the indented `sub` rows below
  // it (e.g. "Effective top speed" over "… hard / … medium / … soft").
  header?: boolean;
  // An indented child row of the entry above it (its label reads "… <variant>").
  sub?: boolean;
  // A secondary value shown muted after the main one as "/ x" (module HP → the
  // auto-repaired HP).
  secondary?: keyof TankSpec;
  // Drop the row entirely (rather than showing "—") when its value is null. For
  // stats that only apply to some vehicles: the clip rows on a single-shot gun,
  // where a dash would just be noise.
  hideWhenEmpty?: boolean;
  // Render the value with a currency glyph (credits/gold/xp) instead of a unit.
  currency?: Currency;
};
export type Group = { title: string; rows: Row[] };

// Grouped tank specifications, in the groups a player reads them in. Values
// come straight from
// the global tank_specs catalogue (parsed from the game client). Missing values
// (a spec that does not apply to this vehicle) render as a dash.
export const GROUPS: Group[] = [
  {
    title: "Firepower",
    rows: [
      { key: "damage", label: "Damage", unit: "hp" },
      { key: "moduleDamage", label: "… vs modules", unit: "hp", sub: true },
      {
        key: "splashRadius",
        label: "… splash radius",
        unit: "m",
        digits: 2,
        sub: true,
        hideWhenEmpty: true,
      },
      { key: "penetration", label: "Penetration", unit: "mm" },
      { key: "penetration500", label: "… at 500m", unit: "mm", sub: true },
      { key: "dpm", label: "DPM", digits: 0 },
      { key: "reload", label: "Reload", unit: "s", digits: 2, lowerBetter: true },
      {
        key: "intraClipReload",
        label: "… intra-clip",
        unit: "s",
        digits: 2,
        lowerBetter: true,
        sub: true,
        hideWhenEmpty: true,
      },
      { key: "clipSize", label: "Clip size", neutral: true, hideWhenEmpty: true },
      {
        compute: (s) =>
          typeof s.clipSize === "number" && typeof s.damage === "number"
            ? s.clipSize * s.damage
            : null,
        label: "… clip damage",
        unit: "hp",
        sub: true,
        hideWhenEmpty: true,
      },
      { key: "rof", label: "Rate of fire", unit: "/min", digits: 2 },
      { key: "aimTime", label: "Aim time", unit: "s", digits: 2, lowerBetter: true },
      { key: "accuracy", label: "Dispersion", unit: "m", digits: 3, lowerBetter: true },
      { key: "dispMoving", label: "… moving", digits: 3, lowerBetter: true, sub: true },
      {
        key: "dispTankTraverse",
        label: "… hull traverse",
        digits: 3,
        lowerBetter: true,
        sub: true,
      },
      {
        key: "dispTurretTraverse",
        label: "… turret traverse",
        digits: 3,
        lowerBetter: true,
        sub: true,
      },
      {
        key: "dispAfterShot",
        label: "… after firing",
        unit: "×",
        digits: 2,
        lowerBetter: true,
        sub: true,
      },
      {
        key: "dispWhileDamaged",
        label: "… gun damaged",
        unit: "×",
        digits: 2,
        lowerBetter: true,
        sub: true,
      },
      { key: "shellVelocity", label: "Shell velocity", unit: "m/s" },
      { key: "maxRange", label: "Max range", unit: "m", neutral: true },
      { key: "caliber", label: "Caliber", unit: "mm", neutral: true },
      { key: "ammoCapacity", label: "Ammo capacity", neutral: true },
      {
        compute: (s) =>
          typeof s.ammoCapacity === "number" && typeof s.damage === "number"
            ? s.ammoCapacity * s.damage
            : null,
        label: "… potential damage",
        unit: "hp",
        sub: true,
      },
      {
        key: "shellCost",
        label: "Shell cost",
        currency: "credits",
        lowerBetter: true,
      },
      {
        key: "ammoCost",
        label: "… full ammo",
        currency: "credits",
        lowerBetter: true,
        sub: true,
      },
      { key: "depression", label: "Gun depression", unit: "°" },
      { key: "elevation", label: "Gun elevation", unit: "°" },
      { key: "gunArc", label: "Gun traverse range", unit: "°", neutral: true },
    ],
  },
  {
    title: "Mobility",
    rows: [
      { key: "speedForward", label: "Top speed", unit: "km/h" },
      { key: "speedBackward", label: "Reverse speed", unit: "km/h" },
      { key: "enginePower", label: "Engine power", unit: "hp" },
      { key: "powerWeight", label: "Power/weight", unit: "hp/t", digits: 1 },
      { key: "hullTraverse", label: "Hull traverse", unit: "°/s", digits: 1 },
      { key: "turretTraverse", label: "Turret traverse", unit: "°/s", digits: 1 },
      { header: true, label: "Terrain resistance" },
      { key: "terrainHard", label: "… hard", digits: 2, lowerBetter: true, sub: true },
      { key: "terrainMedium", label: "… medium", digits: 2, lowerBetter: true, sub: true },
      { key: "terrainSoft", label: "… soft", digits: 2, lowerBetter: true, sub: true },
      { header: true, label: "Effective speed" },
      {
        compute: (s) => effectiveSpeed(s, s.terrainHard),
        label: "… hard",
        unit: "km/h",
        digits: 1,
        sub: true,
      },
      {
        compute: (s) => effectiveSpeed(s, s.terrainMedium),
        label: "… medium",
        unit: "km/h",
        digits: 1,
        sub: true,
      },
      {
        compute: (s) => effectiveSpeed(s, s.terrainSoft),
        label: "… soft",
        unit: "km/h",
        digits: 1,
        sub: true,
      },
      { header: true, label: "Effective traverse" },
      {
        compute: (s, base) => effectiveTraverse(s, base, s.terrainHard),
        label: "… hard",
        unit: "°/s",
        digits: 1,
        sub: true,
      },
      {
        compute: (s, base) => effectiveTraverse(s, base, s.terrainMedium),
        label: "… medium",
        unit: "°/s",
        digits: 1,
        sub: true,
      },
      {
        compute: (s, base) => effectiveTraverse(s, base, s.terrainSoft),
        label: "… soft",
        unit: "°/s",
        digits: 1,
        sub: true,
      },
    ],
  },
  {
    title: "Survivability",
    rows: [
      { key: "health", label: "Hit points", unit: "hp" },
      { header: true, label: "Hull armor" },
      { key: "hullArmorFront", label: "… front", unit: "mm", sub: true },
      { key: "hullArmorSide", label: "… side", unit: "mm", sub: true },
      { key: "hullArmorRear", label: "… rear", unit: "mm", sub: true },
      { header: true, label: "Turret armor" },
      { key: "turretArmorFront", label: "… front", unit: "mm", sub: true },
      { key: "turretArmorSide", label: "… side", unit: "mm", sub: true },
      { key: "turretArmorRear", label: "… rear", unit: "mm", sub: true },
      { key: "trackArmor", label: "Track armor", unit: "mm" },
      {
        key: "engineFireChance",
        label: "Fire chance",
        unit: "%",
        scale: 100,
        // One decimal: the automatic extinguisher scales it by 0.9, so a 15%
        // base drops to 13.5% — an integer would round that to a barely-visible
        // 14% (and a mismatched delta), hiding the effect.
        digits: 1,
        lowerBetter: true,
      },
      {
        key: "trackRepairTime",
        label: "Track repair time",
        unit: "s",
        digits: 2,
        lowerBetter: true,
      },
      { header: true, label: "Module HP (max / repaired)" },
      {
        key: "ammoRackHealth",
        secondary: "ammoRackRepaired",
        label: "… ammo rack",
        unit: "hp",
        sub: true,
      },
      {
        key: "trackHealth",
        secondary: "trackRepaired",
        label: "… track",
        unit: "hp",
        sub: true,
      },
      {
        key: "engineHealth",
        secondary: "engineRepaired",
        label: "… engine",
        unit: "hp",
        sub: true,
      },
      {
        key: "fuelTankHealth",
        secondary: "fuelTankRepaired",
        label: "… fuel tank",
        unit: "hp",
        sub: true,
      },
      {
        key: "turretRingHealth",
        secondary: "turretRingRepaired",
        label: "… turret ring",
        unit: "hp",
        sub: true,
      },
      {
        key: "viewportHealth",
        secondary: "viewportRepaired",
        label: "… viewport",
        unit: "hp",
        sub: true,
      },
    ],
  },
  {
    title: "Spotting & other",
    rows: [
      { key: "viewRange", label: "View range", unit: "m" },
      { key: "radioRange", label: "Signal range", unit: "m" },
      { header: true, label: "Camouflage" },
      { key: "camoStill", label: "… stationary", unit: "%", digits: 1, scale: 100, sub: true },
      { key: "camoMoving", label: "… moving", unit: "%", digits: 1, scale: 100, sub: true },
      { key: "camoStillFiring", label: "… stationary, after firing", unit: "%", digits: 1, scale: 100, sub: true },
      { key: "camoMovingFiring", label: "… moving, after firing", unit: "%", digits: 1, scale: 100, sub: true },
      { key: "weight", label: "Weight", unit: "t", digits: 1, scale: 0.001, lowerBetter: true },
    ],
  },
];

// Terminal (effective) forward speed on a terrain: the engine can only sustain
// the speed where its power matches the rolling resistance, capped by the top
// speed. From the game physics `power = weight * g * f * v`, with the rolling
// coefficient `f = terrainResistance * 0.0738` (calibrated to the game,
// exact across vehicles): `v_kmh = 3657.5 * enginePower_hp / (weight_kg *
// terrainResistance)`, then clamped to the top speed.
const EFFECTIVE_SPEED_K = 3657.5;
function effectiveSpeed(specs: TankSpec, terrain: unknown): number | null {
  const power = specs.enginePower;
  const weight = specs.weight;
  const top = specs.speedForward;
  if (
    typeof power !== "number" ||
    typeof weight !== "number" ||
    typeof top !== "number" ||
    typeof terrain !== "number" ||
    weight <= 0 ||
    terrain <= 0
  )
    return null;
  return Math.min(top, (EFFECTIVE_SPEED_K * power) / (weight * terrain));
}

// Effective hull traverse on a terrain. From the game physics
// (`items/vehicles.py`): the engine-limited rotation scales with engine power
// over weight, `rotationSpeed * (power / defPower) * (defWeight / weight)` (the
// terrainResistance cancels in the hard-terrain limit), then the ground scales
// it by `terrainHard / terrain`, all capped by the mechanical max (the nominal
// hull traverse). So a heavier build turns slower, softer ground turns slower,
// and more engine power (e.g. fuel) turns faster up to the cap, exactly as in
// game (soft verified to the decimal; medium within <1%, its rotation-resistance
// differs slightly from the rolling one we reuse here).
function effectiveTraverse(
  specs: TankSpec,
  baseline: TankSpec | null,
  terrain: unknown,
): number | null {
  const base = specs.hullTraverse;
  const weight = specs.weight;
  const hard = specs.terrainHard;
  const power = specs.enginePower;
  if (
    typeof base !== "number" ||
    typeof weight !== "number" ||
    typeof hard !== "number" ||
    typeof terrain !== "number" ||
    weight <= 0 ||
    terrain <= 0
  )
    return null;
  const dw =
    typeof baseline?.weight === "number" && baseline.weight > 0
      ? baseline.weight
      : weight;
  const dp =
    typeof baseline?.enginePower === "number" && baseline.enginePower > 0
      ? baseline.enginePower
      : null;
  const powerRatio = typeof power === "number" && dp !== null ? power / dp : 1;
  const engineLimited = base * powerRatio * (dw / weight) * (hard / terrain);
  return Math.min(base, engineLimited);
}
