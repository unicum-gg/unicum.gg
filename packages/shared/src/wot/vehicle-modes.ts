import type { TankSpec } from "../db/schema";
import { applyFieldMods, type AppliedFieldMod } from "./field-mods";

/** An alternate driving state a vehicle can switch into. `Siege` is the Swedish
 * TD deploy (better handling, crippled mobility); `Rapid` is the wheeled cruise/
 * rapid switch (more speed). The values are the raw WoT client mode names. */
export enum VehicleModeKind {
  Siege = "siege",
  Rapid = "rapid",
}

/**
 * A vehicle mode as a spec transform. The stat deltas come from WG's
 * `vehicleprofile` mode block relative to its base profile, so `factors` are
 * ratios (mode value / base value) in the field-mod effect shape: applying them
 * with `applyFieldMods` scales our computed spec by the same proportion the game
 * applies, and composes correctly with modules, crew, equipment and field mods
 * on top. Gun depression/elevation aren't crew/equipment-scaled, so they ride as
 * absolute degree overrides (null when the mode leaves the arc unchanged, e.g.
 * wheeled rapid mode).
 */
export interface VehicleMode {
  kind: VehicleModeKind;
  /** Seconds to deploy into the mode. */
  switchOnTime: number;
  /** Seconds to switch back out of the mode. */
  switchOffTime: number;
  /** Ratio effects (aim time, dispersion, reload, hull traverse, speeds) in the
   * field-mod effect shape, folded in by `applyFieldMods` (which also recomputes
   * the dependent DPM/RoF from the reload change). */
  factors: AppliedFieldMod[];
  /** Absolute gun depression in the mode (positive degrees), or null when the
   * mode doesn't change the arc. */
  depression: number | null;
  /** Absolute gun elevation in the mode (positive degrees), or null when the
   * mode doesn't change the arc. */
  elevation: number | null;
}

/**
 * Apply a vehicle mode to a spec: the ratio factors scale the handling/mobility
 * characteristics (reusing the field-mod machinery so DPM/RoF stay consistent),
 * then the absolute gun-arc overrides swap depression/elevation. `shellIdx` is
 * threaded through only so `applyFieldMods`'s per-shell gating stays coherent;
 * modes carry no per-shell effect. Returns a new spec (never mutates the input).
 */
export function applyVehicleMode(
  spec: TankSpec,
  mode: VehicleMode,
  shellIdx: number,
): TankSpec {
  const out: TankSpec = { ...applyFieldMods(spec, mode.factors, shellIdx) };
  if (mode.depression !== null) (out.depression as number) = mode.depression;
  if (mode.elevation !== null) (out.elevation as number) = mode.elevation;
  return out;
}
