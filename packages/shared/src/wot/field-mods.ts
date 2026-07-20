import type { TankSpec } from "../db/schema";

/** A field-modification / skill-tree node effect on one raw wot-src attribute. */
export interface AppliedFieldMod {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

// Progression attributes that move a displayed characteristic. Both systems mix
// the equipment factor bag (`miscAttrs/*`) with direct descriptor paths
// (`descrAttrs/*`); an effect either scales (`mul`, cur*value) or shifts (`add`,
// cur+value) the mapped field. Field modifications tend to `mul`, skill-tree
// nodes tend to `add` on the same fields, so one map serves both. Attributes
// with no displayed characteristic (damaged-state fines, stun, charge-shot
// mechanics, ...) are intentionally absent and change nothing.
const FIELD: Partial<Record<string, keyof TankSpec>> = {
  "miscAttrs/healthFactor": "health",
  "descrAttrs/hull/maxHealth": "health",
  "miscAttrs/enginePowerFactor": "enginePower",
  "descrAttrs/engine/power": "enginePower",
  "miscAttrs/gunReloadTimeFactor": "reload",
  "descrAttrs/gun/reloadTime": "reload",
  "miscAttrs/gunAimingTimeFactor": "aimTime",
  "descrAttrs/gun/aimingTime": "aimTime",
  "miscAttrs/multShotDispersionFactor": "accuracy",
  "descrAttrs/gun/shotDispersionRadius": "accuracy",
  "miscAttrs/additiveShotDispersionFactor": "dispMoving",
  "miscAttrs/chassis/shotDispersionFactors/movement": "dispMoving",
  // Skill-tree nodes reference the chassis dispersion factors by their raw
  // descriptor index (0 = movement, 1 = hull rotation) instead of the named
  // `miscAttrs` form the field mods use.
  "descrAttrs/chassis/shotDispersionFactors/0": "dispMoving",
  "descrAttrs/chassis/shotDispersionFactors/1": "dispTankTraverse",
  "miscAttrs/chassis/shotDispersionFactors/rotation": "dispTankTraverse",
  "miscAttrs/gun/shotDispersionFactors/turretRotation": "dispTurretTraverse",
  "miscAttrs/gun/shotDispersionFactors/whileGunDamaged": "dispWhileDamaged",
  "miscAttrs/gun/shotDispersionFactors/afterShot": "dispAfterShot",
  "miscAttrs/turretRotationSpeed": "turretTraverse",
  "descrAttrs/turret/rotationSpeed": "turretTraverse",
  "descrAttrs/turret/rotationSpeedDegrees": "turretTraverse",
  "descrAttrs/chassis/rotationSpeedDegrees": "hullTraverse",
  // On-move rotation carries the hull-traverse change; the paired on-still
  // factor (same value) is skipped so the effect isn't applied twice.
  "miscAttrs/onMoveRotationSpeedFactor": "hullTraverse",
  "miscAttrs/circularVisionRadiusFactor": "viewRange",
  // Field mods reference view range through the "base" factor variant; same
  // meaning as the plain factor above.
  "miscAttrs/circularVisionRadiusBaseFactor": "viewRange",
  "descrAttrs/turret/circularVisionRadius": "viewRange",
  "miscAttrs/chassisHealthFactor": "trackHealth",
  "miscAttrs/ammoBayHealthFactor": "ammoRackHealth",
  "miscAttrs/engineHealthFactor": "engineHealth",
  "miscAttrs/fuelTankHealthFactor": "fuelTankHealth",
  "descrAttrs/gun/maxAmmo": "ammoCapacity",
  additionalShellAmmoCapacity: "ammoCapacity",
  "miscAttrs/invisibilityFactor": "camoStill",
  "miscAttrs/forwardMaxSpeedKMHTerm": "speedForward",
  "miscAttrs/backwardMaxSpeedKMHTerm": "speedBackward",
  "descrAttrs/engine/maxSpeedBack": "speedBackward",
  "descrAttrs/engine/fireStartingChance": "engineFireChance",
  // The clip gun's intra-clip reload; the DPM/RoF recompute below uses it.
  "miscAttrs/gun/extraShotClip/extraReloadTime": "intraClipReload",
};

// A repair-speed factor shortens the repair time: `time /= value`. The chassis
// factor is track-specific; the general repair-speed factor also speeds up track
// repair (both compound if a mod carries both).
const INV_FIELD: Partial<Record<string, keyof TankSpec>> = {
  "miscAttrs/chassisRepairSpeedFactor": "trackRepairTime",
  "miscAttrs/repairSpeedFactor": "trackRepairTime",
};

// A factor that scales several fields at once (mul only).
const MUL_MULTI_FIELD: Partial<Record<string, (keyof TankSpec)[]>> = {
  "miscAttrs/rollingFrictionFactor": [
    "terrainHard",
    "terrainMedium",
    "terrainSoft",
  ],
  "miscAttrs/invisibilityMultFactor": ["camoStill", "camoMoving"],
};

// A term added to the base invisibility of several fields at once (add only).
// Applied before applyCamouflage, so the crew camo factor scales it too, as the
// game does for a "base" additive.
const ADD_MULTI_FIELD: Partial<Record<string, (keyof TankSpec)[]>> = {
  "miscAttrs/invisibilityBaseAdditive": ["camoStill", "camoMoving"],
};

// Per-shell attributes: they only apply while shell `i` is the selected one (the
// shot/shell index equals the ammo panel's shell order). Each captures the index
// and maps to the fields to shift.
const PER_SHELL: { re: RegExp; fields: (keyof TankSpec)[] }[] = [
  { re: /^descrAttrs\/shot(\d)\/piercingPower$/, fields: ["penetration", "penetration500"] },
  { re: /^descrAttrs\/shot(\d)\/speed$/, fields: ["shellVelocity"] },
  { re: /^descrAttrs\/shell(\d)\/armorDamage$/, fields: ["damage"] },
];

// Gun elevation/depression sit in `gunPitchLimits`: `minPitchDegrees` is the
// (negative) elevation and `maxPitchDegrees/<pos>` the (positive) depression per
// turret-yaw position. We take one representative position and flip the
// elevation sign to our positive-degrees convention.
const PITCH_DEPRESSION = "descrAttrs/gunPitchLimits/maxPitchDegrees/0";
const PITCH_ELEVATION = "descrAttrs/gunPitchLimits/minPitchDegrees";

/**
 * Whether an effect attribute maps to a displayed characteristic, i.e.
 * `applyFieldMods` actually changes something for it. The skill tree uses this to
 * show only meaningful effect rows: a tier-XI vehicle-mechanic node carries exotic
 * ability parameters (`battleFury/duration`, `chargeShot/*`, ...) that aren't
 * characteristics, and its own game description already explains the mechanic.
 */
export function fieldModAffectsSpec(attribute: string): boolean {
  if (
    attribute in FIELD ||
    attribute in INV_FIELD ||
    attribute in MUL_MULTI_FIELD ||
    attribute in ADD_MULTI_FIELD ||
    attribute === PITCH_DEPRESSION ||
    attribute === PITCH_ELEVATION
  )
    return true;
  return PER_SHELL.some(({ re }) => re.test(attribute));
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * Apply unlocked field modifications or skill-tree nodes to a spec (both use the
 * same effect format). Effects scale (`mul`) or shift (`add`) the characteristic
 * their attribute maps to; per-shell effects gate on the selected shell.
 * Dependent fields (dpm/rof from reload and damage, power/weight from engine
 * power) are rescaled so they stay consistent.
 */
export function applyFieldMods(
  spec: TankSpec,
  effects: AppliedFieldMod[],
  shellIdx: number,
): TankSpec {
  if (effects.length === 0) return spec;
  const out: TankSpec = { ...spec };
  const reload0 = num(out.reload);
  const power0 = num(out.enginePower);
  const damage0 = num(out.damage);

  const shift = (field: keyof TankSpec, e: AppliedFieldMod) => {
    const cur = num(out[field]);
    if (cur === null) return;
    (out[field] as number) = e.type === "mul" ? cur * e.value : cur + e.value;
  };

  for (const e of effects) {
    let handled = false;
    for (const { re, fields } of PER_SHELL) {
      const m = re.exec(e.attribute);
      if (!m) continue;
      handled = true;
      if (Number(m[1]) === shellIdx) for (const f of fields) shift(f, e);
      break;
    }
    if (handled) continue;

    if (e.attribute === PITCH_DEPRESSION) {
      const cur = num(out.depression);
      if (cur !== null) (out.depression as number) = cur + e.value;
      continue;
    }
    if (e.attribute === PITCH_ELEVATION) {
      const cur = num(out.elevation);
      if (cur !== null) (out.elevation as number) = cur - e.value;
      continue;
    }

    const inv = INV_FIELD[e.attribute];
    if (inv) {
      const cur = num(out[inv]);
      if (cur !== null && e.value !== 0) (out[inv] as number) = cur / e.value;
      continue;
    }
    const multi = MUL_MULTI_FIELD[e.attribute];
    if (multi) {
      for (const f of multi) {
        const cur = num(out[f]);
        if (cur !== null) (out[f] as number) = cur * e.value;
      }
      continue;
    }
    const addMulti = ADD_MULTI_FIELD[e.attribute];
    if (addMulti) {
      for (const f of addMulti) {
        const cur = num(out[f]);
        if (cur !== null) (out[f] as number) = cur + e.value;
      }
      continue;
    }
    const field = FIELD[e.attribute];
    if (!field) continue;
    if (field === "health" && e.type === "mul") {
      // Health factors ceil to the nearest 10, as with equipment.
      const cur = num(out.health);
      if (cur !== null)
        (out.health as number) = Math.ceil((cur * e.value) / 10 - 1e-9) * 10;
      continue;
    }
    shift(field, e);
  }

  // Dependent fields: DPM and rate of fire follow the gun cycle. A clip gun's
  // cycle is the clip reload plus the intra-clip gaps, so any change to reload,
  // intra-clip reload or damage recomputes them from the clip formula (the same
  // one the parser uses for the base spec, so it is idempotent when untouched);
  // a single-shot gun rescales by the reload/damage ratio.
  const reload1 = num(out.reload);
  const damage1 = num(out.damage);
  const clip = num(out.clipSize);
  const intra1 = num(out.intraClipReload);
  if (clip !== null && clip > 1 && reload1 !== null && damage1 !== null) {
    const cycle = reload1 + (clip - 1) * (intra1 ?? 0);
    if (cycle > 0) {
      (out.dpm as number) = (damage1 * clip * 60) / cycle;
      (out.rof as number) = (clip * 60) / cycle;
    }
  } else if (
    (reload0 && reload1 && reload1 !== reload0) ||
    (damage0 && damage1 && damage1 !== damage0)
  ) {
    const r = ((reload0 ?? 1) / (reload1 ?? 1)) * ((damage1 ?? 1) / (damage0 ?? 1));
    const dpm = num(out.dpm);
    const rof = num(out.rof);
    if (dpm !== null) (out.dpm as number) = dpm * r;
    // Rate of fire only tracks reload, not damage.
    const rofR = (reload0 ?? 1) / (reload1 ?? 1);
    if (rof !== null) (out.rof as number) = rof * rofR;
  }
  const power1 = num(out.enginePower);
  if (power0 && power1 && power1 !== power0) {
    const pw = num(out.powerWeight);
    if (pw !== null) (out.powerWeight as number) = pw * (power1 / power0);
  }

  return out;
}
