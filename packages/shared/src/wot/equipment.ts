import type { EquipmentEffect } from "@unicum.gg/wargaming";
import type { TankSpec } from "../db/schema";

/** An equipment mounted in a slot, with `bonus` set when the slot's category
 * matches the equipment (Equipment 2.0 category bonus). */
export interface AppliedEquipment {
  effects: EquipmentEffect[];
  bonus: boolean;
}

// wot-src `miscAttrs/*` attributes that map to a characteristic we display, and
// how they combine: `mul` scales the field, `add` shifts it. Attributes with no
// visible characteristic (crew, stun, repair, fuel/engine module HP, ...) are
// intentionally absent so they don't silently do nothing-looking work.
const MUL_FIELD: Partial<Record<string, keyof TankSpec>> = {
  "miscAttrs/gunReloadTimeFactor": "reload",
  "miscAttrs/gunAimingTimeFactor": "aimTime",
  "miscAttrs/additiveShotDispersionFactor": "dispMoving",
  "miscAttrs/multShotDispersionFactor": "accuracy",
  "miscAttrs/enginePowerFactor": "enginePower",
  "miscAttrs/circularVisionRadiusFactor": "viewRange",
  "miscAttrs/turretRotationSpeed": "turretTraverse",
  "miscAttrs/healthFactor": "health",
  "miscAttrs/fireStartingChanceFactor": "engineFireChance",
  "miscAttrs/chassisHealthFactor": "trackHealth",
  "miscAttrs/ammoBayHealthFactor": "ammoRackHealth",
  // Synthetic attributes for devices with no standard `<factor>` (see the SDK's
  // equipment parser): the Binocular Telescope scales view range.
  circularVisionRadius: "viewRange",
};

// Attributes that scale several fields at once. Additional Grousers scale all
// three terrain-resistance grounds by one `rotationFactor`.
const MUL_MULTI_FIELD: Partial<Record<string, (keyof TankSpec)[]>> = {
  rotationFactor: ["terrainHard", "terrainMedium", "terrainSoft"],
};
const ADD_FIELD: Partial<Record<string, keyof TankSpec>> = {
  "miscAttrs/forwardMaxSpeedKMHTerm": "speedForward",
  "miscAttrs/backwardMaxSpeedKMHTerm": "speedBackward",
};

// Directive (battle booster) attributes map to the same characteristics as
// equipment, but under wot-src's device-attribute names (no `miscAttrs/`
// prefix). Only the attributes that move a displayed field are listed; a
// directive on crew/repair (no visible characteristic) simply changes nothing.
const DIRECTIVE_MUL_FIELD: Partial<Record<string, keyof TankSpec>> = {
  "gun/reloadTime": "reload",
  "gun/aimingTime": "aimTime",
  circularVisionRadius: "viewRange",
  additiveShotDispersionFactor: "dispMoving",
  multShotDispersionFactor: "accuracy",
  "engine/power": "enginePower",
};

/** A directive applied on top of the mounted equipment. */
export interface AppliedDirective {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

/** True when a directive's attribute maps to a displayed characteristic (so
 * toggling it visibly changes the specs). Directives on crew/repair/concealment
 * move nothing we render and are filtered out upstream. */
export function directiveAffectsSpec(attribute: string): boolean {
  return attribute in DIRECTIVE_MUL_FIELD;
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * Apply a set of mounted equipment to a spec, returning a new spec. Effects
 * compound (multiple items scale/shift the same field in turn). Derived fields
 * that aren't stored primitives (dpm/rof from reload, power/weight from engine
 * power) are rescaled by the same ratio so they stay consistent.
 */
export function applyEquipment(
  spec: TankSpec,
  mounted: AppliedEquipment[],
): TankSpec {
  const out: TankSpec = { ...spec };
  const reload0 = num(out.reload);
  const power0 = num(out.enginePower);

  for (const { effects, bonus } of mounted) {
    for (const e of effects) {
      const value = bonus ? e.bonus : e.base;
      if (e.type === "mul") {
        const multi = MUL_MULTI_FIELD[e.attribute];
        if (multi) {
          for (const f of multi) {
            const cur = num(out[f]);
            if (cur !== null) (out[f] as number) = cur * value;
          }
          continue;
        }
        const field = MUL_FIELD[e.attribute];
        const cur = field ? num(out[field]) : null;
        if (field && cur !== null)
          // A health-boost equipment ceils the total HP up to the nearest 10
          // (`ceilTo(hp * factor, VEHICLE_HEALTH_DECIMALS)` in the game), so e.g.
          // 2200 * 1.08 = 2376 shows as 2380, not 2376. Other fields scale plain.
          (out[field] as number) =
            e.attribute === "miscAttrs/healthFactor"
              ? Math.ceil((cur * value) / 10 - 1e-9) * 10
              : cur * value;
      } else if (e.type === "add") {
        const field = ADD_FIELD[e.attribute];
        const cur = field ? num(out[field]) : null;
        if (field && cur !== null) (out[field] as number) = cur + value;
      }
    }
  }

  // Rescale the fields we display but don't recompute from primitives.
  const reload1 = num(out.reload);
  if (reload0 && reload1 && reload1 !== reload0) {
    const r = reload0 / reload1;
    const dpm = num(out.dpm);
    const rof = num(out.rof);
    if (dpm !== null) (out.dpm as number) = dpm * r;
    if (rof !== null) (out.rof as number) = rof * r;
  }
  const power1 = num(out.enginePower);
  if (power0 && power1 && power1 !== power0) {
    const pw = num(out.powerWeight);
    if (pw !== null) (out.powerWeight as number) = pw * (power1 / power0);
  }

  return out;
}

/**
 * Apply active directives on top of an already equipment-adjusted spec. Each
 * directive scales (`mul`) or shifts (`add`) the characteristic its attribute
 * maps to; the dependent fields (dpm/rof from reload, power/weight from engine
 * power) are rescaled by the same ratio, exactly like `applyEquipment`, so
 * chaining the two stays consistent.
 */
export function applyDirectives(
  spec: TankSpec,
  directives: AppliedDirective[],
): TankSpec {
  if (directives.length === 0) return spec;
  const out: TankSpec = { ...spec };
  const reload0 = num(out.reload);
  const power0 = num(out.enginePower);

  for (const d of directives) {
    const field = DIRECTIVE_MUL_FIELD[d.attribute];
    if (!field) continue;
    const cur = num(out[field]);
    if (cur === null) continue;
    (out[field] as number) = d.type === "mul" ? cur * d.value : cur + d.value;
  }

  const reload1 = num(out.reload);
  if (reload0 && reload1 && reload1 !== reload0) {
    const r = reload0 / reload1;
    const dpm = num(out.dpm);
    const rof = num(out.rof);
    if (dpm !== null) (out.dpm as number) = dpm * r;
    if (rof !== null) (out.rof as number) = rof * r;
  }
  const power1 = num(out.enginePower);
  if (power0 && power1 && power1 !== power0) {
    const pw = num(out.powerWeight);
    if (pw !== null) (out.powerWeight as number) = pw * (power1 / power0);
  }

  return out;
}

// Consumable script tags that scale a displayed characteristic (all `mul`).
const CONSUMABLE_MUL_FIELD: Partial<Record<string, keyof TankSpec>> = {
  enginePowerFactor: "enginePower",
  turretRotationSpeedFactor: "turretTraverse",
  fireStartingChanceFactor: "engineFireChance",
  maxSpeedFactor: "speedForward",
};

/**
 * Apply the additive camo bonuses of camo devices. The game adds an
 * `invisibilityBonus` to `invisibilityAdditiveTerm` (post crew factor): a
 * Camouflage Net only helps while stationary (still camo), a low-noise exhaust
 * keeps working on the move (still + moving). Not stacked across sources (the
 * game takes the max), so the caller passes the already-maxed bonuses.
 */
export function applyCamoNet(
  spec: TankSpec,
  stillBonus: number,
  movingBonus: number,
): TankSpec {
  if (stillBonus <= 0 && movingBonus <= 0) return spec;
  const out: TankSpec = { ...spec };
  const add = (k: keyof TankSpec, bonus: number) => {
    const cur = num(out[k]);
    if (cur !== null) (out[k] as number) = cur + bonus;
  };
  if (stillBonus > 0) {
    add("camoStill", stillBonus);
    add("camoStillFiring", stillBonus);
  }
  if (movingBonus > 0) {
    add("camoMoving", movingBonus);
    add("camoMovingFiring", movingBonus);
  }
  return out;
}

/** A consumable's passive effect (multiplicative). */
export interface AppliedConsumable {
  attribute: string;
  value: number;
}

/**
 * Apply mounted consumables' passive effects to a spec (improved fuel scales
 * engine power + turret traverse, the automatic extinguisher lowers fire chance,
 * ...). Repair/first-aid kits and crew rations carry no displayed effect.
 * Power/weight is rescaled with engine power, like the other apply steps.
 */
export function applyConsumables(
  spec: TankSpec,
  consumables: AppliedConsumable[],
): TankSpec {
  if (consumables.length === 0) return spec;
  const out: TankSpec = { ...spec };
  const power0 = num(out.enginePower);

  for (const c of consumables) {
    const field = CONSUMABLE_MUL_FIELD[c.attribute];
    if (!field) continue;
    const cur = num(out[field]);
    if (cur === null) continue;
    (out[field] as number) = cur * c.value;
  }

  const power1 = num(out.enginePower);
  if (power0 && power1 && power1 !== power0) {
    const pw = num(out.powerWeight);
    if (pw !== null) (out.powerWeight as number) = pw * (power1 / power0);
  }

  return out;
}
