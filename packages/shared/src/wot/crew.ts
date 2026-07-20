import type { TankSpec } from "../db/schema";

// wot-src crew-skill `paramName`s that map to a displayed characteristic, scaled
// multiplicatively: the field becomes `field * (1 + value * points)`. The
// `value` sign already points the raw field in the improving direction (view
// range up, dispersion down, ...), so the same formula fits every entry.
// Attributes with no displayed field (turret-rotation dispersion, camo masking,
// terrain passability, crew level, damage-roll spread, ...) are intentionally
// absent: their in-game formula isn't a plain factor on a value we render, so
// applying them naively would show a wrong number.
const MUL_FIELD: Partial<Record<string, keyof TankSpec>> = {
  circularVisionRadius: "viewRange",
  vehicleCircularVisionRadius: "viewRange",
  vehicleGunShotDispersionChassisMovement: "dispMoving",
  shotDispersionAngle: "accuracy",
  vehicleAllGroundRotationSpeed: "hullTraverse",
  vehicleTurretRotationSpeed: "turretTraverse",
  vehicleAmmoBayStrength: "ammoRackHealth",
  shellVelocity: "shellVelocity",
};

// Aim *speed* improves aim *time* inversely: a faster aim is a shorter aim time,
// so `aimTime` becomes `aimTime / (1 + value * points)`. `vehicleRepairSpeed`
// (the Repairs skill) maps here too so the catalogue/server filter recognises it
// as affecting the track repair time, but it is NOT applied through this linear
// model: the game speeds up repair through the same crew role factor as every
// other crew stat, so it goes through the dedicated `applyRepairs` below.
const INV_FIELD: Partial<Record<string, keyof TankSpec>> = {
  vehicleGunAimSpeed: "aimTime",
  vehicleRepairSpeed: "trackRepairTime",
};

/** The displayed characteristic a crew-skill attribute moves, or null when it
 * moves nothing we render (so the skill shows in the catalogue without a delta). */
export function crewSkillField(param: string): keyof TankSpec | null {
  return MUL_FIELD[param] ?? INV_FIELD[param] ?? null;
}

/** True when a crew-skill attribute maps to a displayed characteristic. */
export function crewSkillAffectsSpec(param: string): boolean {
  return param in MUL_FIELD || param in INV_FIELD;
}

/** One passive effect of a selected crew skill: the wot-src attribute and its
 * per-skill-level-point magnitude. */
export interface CrewSkillFieldEffect {
  param: string;
  value: number;
}

/** A crew skill the player has selected, with its spec-affecting effects.
 * `scale` multiplies the skill's training level: the commander raises every
 * other crew member's effective skill level by 10% of his own (VehicleDescrCrew
 * `_calcLeverIncreaseForNonCommander`, `COMMANDER_ADDITION_RATIO = 10`), so a
 * skill trained on a non-commander member carries `scale: 1.1` while the
 * commander's own skills stay at 1 (he gets no self bonus). */
export interface AppliedCrewSkill {
  effects: CrewSkillFieldEffect[];
  scale?: number;
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

// A crew member can train at most 6 skills/perks (the client's
// `NEW_PERK_SYSTEM.MAX_MAJOR_PERKS` in constants.py).
export const MAX_MAJOR_PERKS = 6;

// The major qualification never drops below 50% (`MIN_ROLE_LEVEL = 50` in the
// client's tankmen.py); a freshly recruited crew starts there.
export const MIN_ROLE_LEVEL = 50;

/**
 * Apply the selected crew skills to a spec at a given training level. `level` is
 * a 0–1 fraction (100% = a fully trained skill); a skill trains from 0 to 100
 * points, so the effective magnitude of each effect is `value * level * 100`.
 * Each selected skill instance compounds (a stat trained on two crew members of
 * the same role applies twice, as in game).
 */
export function applyCrewSkills(
  spec: TankSpec,
  skills: AppliedCrewSkill[],
  level: number,
): TankSpec {
  if (skills.length === 0 || level <= 0) return spec;
  const out: TankSpec = { ...spec };

  for (const s of skills) {
    // The commander bonus scales the member's effective training (110 points
    // for a fully trained non-commander member under a 100% commander).
    const points = level * 100 * (s.scale ?? 1);
    for (const e of s.effects) {
      const factor = e.value * points;
      const mul = MUL_FIELD[e.param];
      if (mul) {
        const cur = num(out[mul]);
        if (cur !== null) (out[mul] as number) = cur * (1 + factor);
        continue;
      }
      const inv = INV_FIELD[e.param];
      if (inv) {
        // The Repairs skill moves the repair time through the crew role factor
        // (applyRepairs), not this linear model; skip it here.
        if (e.param === "vehicleRepairSpeed") continue;
        const cur = num(out[inv]);
        if (cur !== null && 1 + factor !== 0)
          (out[inv] as number) = cur / (1 + factor);
      }
    }
  }

  return out;
}

// The game's crew role factor for an effective crew level (1.0 = 100% trained):
// `factor = 0.57 + 0.43 * level` (wot-src VehicleDescrCrew `_processSkills`).
const roleFactor = (level: number): number => 0.57 + 0.43 * level;

/**
 * Apply the crew's major-qualification training level to a spec. This is the big
 * one: the game runs every crew-affected stat through the per-role factor
 * `0.57 + 0.43 * level` (wot-src `_processSkills` + the `_updateXxxFactors`
 * handlers), so a half-trained crew is drastically worse (~-21% view range,
 * ~+27% reload/aim/dispersion) and a 100% crew is nominal. Our stored specs are
 * the 100% values, so `level` 1 leaves them unchanged and below degrades them.
 * `level` is 0-1.
 *
 * Roles → stats: commander → view range, radioman → radio range, gunner →
 * turret traverse / aim time / dispersion, loader → reload, driver → terrain.
 */
export function applyCrewQualification(spec: TankSpec, level: number): TankSpec {
  if (level >= 1) return spec;
  const f = roleFactor(level < 0 ? 0 : level);
  const out: TankSpec = { ...spec };
  const reload0 = num(out.reload);

  // Stats that scale with the factor (worse as the crew de-trains).
  for (const k of ["viewRange", "radioRange", "turretTraverse"] as const) {
    const cur = num(out[k]);
    if (cur !== null) (out[k] as number) = cur * f;
  }
  // Stats measured so that lower is better: they scale with 1 / factor.
  for (const k of [
    "reload",
    "aimTime",
    "accuracy",
    "dispMoving",
    "terrainHard",
    "terrainMedium",
    "terrainSoft",
  ] as const) {
    const cur = num(out[k]);
    if (cur !== null) (out[k] as number) = cur / f;
  }

  // dpm/rof track reload.
  const reload1 = num(out.reload);
  if (reload0 && reload1 && reload1 !== reload0) {
    const r = reload0 / reload1;
    const dpm = num(out.dpm);
    const rof = num(out.rof);
    if (dpm !== null) (out.dpm as number) = dpm * r;
    if (rof !== null) (out.rof as number) = rof * r;
  }

  return out;
}

/**
 * Apply the Camouflage crew skill to a spec's camo values. The game computes
 * `camo = baseInvisibility * (0.57 + 0.43 * camoSkillLevel)` (wot-src
 * `computeBaseInvisibility` + the camouflage group-skill factor), and our stored
 * camo is the base invisibility (i.e. the value at a *fully trained* camo skill,
 * factor 1.0). So a skill level of 0 gives 57% of the stored value (no camo
 * skill) and a level of 1 gives 100% (the stored value). `camoLevel` is 0-1.
 */
export function applyCamouflage(spec: TankSpec, camoLevel: number): TankSpec {
  // No upper clamp: the commander bonus pushes a fully trained crew's effective
  // camo level slightly past 1 (4 members -> 1.075), as in game.
  const level = camoLevel < 0 ? 0 : camoLevel;
  const f = roleFactor(level);
  const out: TankSpec = { ...spec };
  for (const k of [
    "camoStill",
    "camoMoving",
    "camoStillFiring",
    "camoMovingFiring",
  ] as const) {
    const cur = num(out[k]);
    if (cur !== null) (out[k] as number) = cur * f;
  }
  return out;
}

// The Repairs skill's speed gain: WG documents "+80% repair speed" for a fully
// trained crew (tankmen.xml `<repair>` = 0.008/point → 0.8 at 100 points). Repair
// *time* is `base / (1 + 0.8 * r)`, where `r` is the effective repair crew level.
export const REPAIR_SPEED_AT_FULL = 0.8;

/**
 * Apply the Repairs common skill to a spec's track repair time. WG: a crew fully
 * trained in Repairs repairs modules **80% faster**, so the displayed time is
 * `base / (1 + 0.8 * r)` (NOT the `0.57 + 0.43` role factor, which tops out at
 * the raw time and is wrong here). Our stored `trackRepairTime` is the no-skill
 * value (`base`), so `r = 0` leaves it unchanged and `r = 1` divides it by 1.8.
 *
 * `repairLevel` is the crew-averaged Repairs level, already including the
 * commander's contribution (so a 4-man crew all trained in Repairs is ~1.075, not
 * 1.0, and repair drops a touch below the bare +80%). `crewLevelBoost` (Brothers
 * in Arms + food + Ventilation, in crew-level points) raises `r` further, exactly
 * like these boosts already speed up view range / reload / aiming. The boost only
 * helps once Repairs is trained (`repairLevel <= 0` → no-op): a crew does not
 * repair faster from BiA alone.
 */
export function applyRepairs(
  spec: TankSpec,
  repairLevel: number,
  crewLevelBoost = 0,
): TankSpec {
  if (repairLevel <= 0) return spec;
  const cur = num(spec.trackRepairTime);
  if (cur === null) return spec;
  const r = repairLevel + Math.max(0, crewLevelBoost) / 100;
  const out: TankSpec = { ...spec };
  (out.trackRepairTime as number) = cur / (1 + REPAIR_SPEED_AT_FULL * r);
  return out;
}

/**
 * Apply a crew-training-level increase (Brothers in Arms + crew-level
 * consumables) to a spec. Unlike a per-characteristic perk, this raises the
 * whole crew's effective level, which the game turns into a small bonus on every
 * crew-affected stat through the per-role factor `0.57 + 0.43 * level` and a
 * commander contribution (`COMMANDER_ADDITION_RATIO = 10`). We apply the
 * *marginal* change over a standard 100%-trained crew, so it matches the game's
 * ~+2% view range / ~-2% reload & aiming for a full-crew BiA. `increase` is in
 * crew-level points (BiA on the whole crew at 100% = 5).
 *
 * Reference (baseline over which the marginal is taken, from the engine):
 * - commander effective level e0 = 1.0 (no self commander bonus).
 * - other roles e0 = 1.1 (the always-present +10% commander contribution).
 */
export function applyCrewLevel(spec: TankSpec, increase: number): TankSpec {
  if (increase <= 0) return spec;
  const c = increase; // level points added to the crew

  // Commander-driven stats (view range).
  const cmd = roleFactor(1 + c / 100) / roleFactor(1);
  // Other roles: e0 = 1.1, and the increase propagates with the commander
  // contribution, so Δe = 1.1 * c / 100.
  const e0 = 1.1;
  const f0 = roleFactor(e0);
  const f1 = roleFactor(e0 + (1.1 * c) / 100);
  const up = f1 / f0; // stats that scale with the factor (traverse, radio)
  const down = f0 / f1; // stats that scale with 1 / factor (reload, aim, disp, terrain)

  const out: TankSpec = { ...spec };
  const reload0 = num(out.reload);
  const scale = (field: keyof TankSpec, factor: number) => {
    const cur = num(out[field]);
    if (cur !== null) (out[field] as number) = cur * factor;
  };

  scale("viewRange", cmd); // commander -> circularVisionRadius
  scale("radioRange", up); // radioman -> radio/distance
  scale("turretTraverse", up); // gunner -> turret/rotationSpeed
  scale("reload", down); // loader -> gun/reloadTime (1/factor)
  scale("aimTime", down); // gunner -> gun/aimingTime (1/factor)
  scale("accuracy", down); // gunner -> shot dispersion (1/factor)
  scale("dispMoving", down); // gunner shot-dispersion factor scales all dispersion
  scale("terrainHard", down); // driver -> terrain resistance (1/factor)
  scale("terrainMedium", down);
  scale("terrainSoft", down);

  // dpm/rof track reload.
  const reload1 = num(out.reload);
  if (reload0 && reload1 && reload1 !== reload0) {
    const r = reload0 / reload1;
    const dpm = num(out.dpm);
    const rof = num(out.rof);
    if (dpm !== null) (out.dpm as number) = dpm * r;
    if (rof !== null) (out.rof as number) = rof * r;
  }

  return out;
}
