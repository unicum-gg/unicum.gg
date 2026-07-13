// Co-located response schema (`.api.ts` so next-openapi-gen scans it). The route
// projects a `TankSpec` onto this schema via `.parse()`, so the field list lives
// in one place (the economics columns are exposed by the /economics endpoint).
import { z } from "zod";
import { tankIdentity } from "../identity.api";

const n = () => z.number().nullable();

export const tankSpecifications = z
  .object({
    // Firepower
    damage: n(),
    moduleDamage: n(),
    splashRadius: n(),
    reload: n(),
    rof: n(),
    intraClipReload: n(),
    dpm: n(),
    penetration: n(),
    caliber: n(),
    shellVelocity: n(),
    // Gun handling
    accuracy: n(),
    aimTime: n(),
    dispMoving: n(),
    dispTankTraverse: n(),
    dispTurretTraverse: n(),
    dispAfterShot: n(),
    dispWhileDamaged: n(),
    gunArc: n(),
    depression: n(),
    elevation: n(),
    // Mobility
    speedForward: n(),
    speedBackward: n(),
    hullTraverse: n(),
    turretTraverse: n(),
    enginePower: n(),
    powerWeight: n(),
    terrainHard: n(),
    terrainMedium: n(),
    terrainSoft: n(),
    // Survivability
    health: n(),
    engineHealth: n(),
    engineFireChance: n(),
    hullArmorFront: n(),
    turretArmorFront: n(),
    trackArmor: n(),
    trackHealth: n(),
    trackRepairTime: n(),
    ammoRackHealth: n(),
    // Concealment & recon
    weight: n(),
    viewRange: n(),
    radioRange: n(),
    camoStill: n(),
    camoMoving: n(),
    camoStillFiring: n(),
    camoMovingFiring: n(),
  })
  .meta({
    id: "TankSpecifications",
    description:
      "A tank's top-configuration combat specifications: firepower, gun handling, mobility, survivability, concealment and recon. Region-agnostic values.",
  });

/** Response of `GET /{region}/tanks/specifications`. */
export const TankSpecsResponse = z.object({
  results: z.array(
    z.object({
      identity: tankIdentity,
      specifications: tankSpecifications.nullable(),
    }),
  ),
});
