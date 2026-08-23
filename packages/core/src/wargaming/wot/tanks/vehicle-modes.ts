import { WotSrcBranch, type Region } from "@unicum.gg/wargaming";
import {
  VehicleModeKind,
  type AppliedFieldMod,
  type VehicleMode,
} from "@unicum.gg/shared";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// The vehicle profile (like the rest of the encyclopedia) changes only on a game
// patch; the derived modes are cached in Redis for a day, shared across instances.
const TTL_SECONDS = 24 * 60 * 60;

// The base value each mode field is measured against, and the field-mod attribute
// its ratio scales in our spec. All are `mul` factors, so `applyFieldMods` folds
// them into the same characteristics field mods touch (and recomputes DPM/RoF
// from the reload change). Kept as string keys the front already labels.
const AIM = "miscAttrs/gunAimingTimeFactor";
const DISPERSION = "miscAttrs/multShotDispersionFactor";
const RELOAD = "miscAttrs/gunReloadTimeFactor";
const HULL_TRAVERSE = "miscAttrs/onMoveRotationSpeedFactor";
const SPEED_FORWARD = "miscAttrs/forwardMaxSpeedKMHTerm";
const SPEED_BACKWARD = "miscAttrs/backwardMaxSpeedKMHTerm";

/** A ratio effect (mode / base) in the field-mod shape, or null when either side
 * is missing/non-positive or the ratio is a no-op (mode == base). */
function ratio(
  attribute: string,
  base: number | null | undefined,
  mode: number | null | undefined,
): AppliedFieldMod | null {
  if (base == null || mode == null || base <= 0 || mode <= 0) return null;
  const value = mode / base;
  if (!Number.isFinite(value) || value === 1) return null;
  return { attribute, type: "mul", value };
}

/**
 * The alternate driving modes a tank can switch into (siege for Swedish TDs,
 * rapid for wheeled vehicles), derived from WG's `vehicleprofile`: each mode's
 * block carries the deployed values, the surrounding default profile the base
 * ones, so we store their ratio (mode / base) as field-mod-style factors the
 * configurator applies on top of the selected build. Empty for every vehicle
 * without a mode (the vast majority) or when WG has no profile for the tank.
 */
export function getTankVehicleModes(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<VehicleMode[]> {
  return cachedInRedis(`wg:vehicle-modes:${region}${branch ? `:${branch}` : ""}:${tankId}`, TTL_SECONDS, () =>
    computeTankVehicleModes(region, tankId, branch),
  );
}

// `branch` reaches this far to key the cache, not to change the read: WG runs no
// encyclopedia for the test server, so `vehicleprofile` only ever describes the
// live client. A test-only vehicle therefore has no modes at all (WG has never
// heard of it), and a rebalanced one shows its live siege/rapid ratios. Kept as
// a parameter so those two answers do not share one entry.
async function computeTankVehicleModes(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<VehicleMode[]> {
  const profile = await wg.region(region).api.wot.encyclopedia.vehicleprofile({
    tankId,
    fields: [
      "siege",
      "rapid",
      "speed_forward",
      "speed_backward",
      "gun",
      "suspension",
    ],
  });
  if (!profile) return [];

  const modes: VehicleMode[] = [];
  const gun = profile.gun;
  const suspension = profile.suspension;

  const { siege } = profile;
  if (siege) {
    const factors = [
      ratio(AIM, gun?.aim_time, siege.aim_time),
      ratio(DISPERSION, gun?.dispersion, siege.dispersion),
      ratio(RELOAD, gun?.reload_time, siege.reload_time),
      ratio(HULL_TRAVERSE, suspension?.traverse_speed, siege.suspension_traverse_speed),
      ratio(SPEED_BACKWARD, profile.speed_backward, siege.speed_backward),
    ].filter((e): e is AppliedFieldMod => e !== null);
    modes.push({
      kind: VehicleModeKind.Siege,
      switchOnTime: siege.switch_on_time,
      switchOffTime: siege.switch_off_time,
      factors,
      // WG reports the deployed gun arc directly; swap it in absolutely (arcs
      // don't scale with crew/equipment).
      depression: siege.move_down_arc ?? null,
      elevation: siege.move_up_arc ?? null,
    });
  }

  const { rapid } = profile;
  if (rapid) {
    const factors = [
      ratio(SPEED_FORWARD, profile.speed_forward, rapid.speed_forward),
      ratio(SPEED_BACKWARD, profile.speed_backward, rapid.speed_backward),
    ].filter((e): e is AppliedFieldMod => e !== null);
    modes.push({
      kind: VehicleModeKind.Rapid,
      switchOnTime: rapid.switch_on_time,
      switchOffTime: rapid.switch_off_time,
      factors,
      depression: null,
      elevation: null,
    });
  }

  return modes;
}
