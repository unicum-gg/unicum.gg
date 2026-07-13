// Shared category + row schemas for the /tanks datasets, reused by both the bulk
// list endpoints (`{ results: [row] }`) and the per-tank endpoints (`row`), so
// each shape lives in one place. `.api.ts` so next-openapi-gen scans it.
import { z } from "zod";
import { tankIdentity } from "./identity.api";

const n = () => z.number().nullable();

export const tankServerStats = z
  .object({
    players: z.number(),
    avg_battles: z.number(),
    total_battles: n(),
    avg_damage: z.number(),
    winrate: z.number(),
    player_wr: n(),
    wn7: n(),
    wn8: n(),
    wnx: n(),
    avg_spots: n(),
    avg_assist: n(),
    kdr: n(),
    hit_pct: n(),
    pen_pct: n(),
    avg_blocked: n(),
    survival: n(),
    moe1: n(),
    moe2: n(),
    moe3: n(),
    mom_class3: n(),
    mom_class2: n(),
    mom_class1: n(),
    mom_ace: n(),
  })
  .meta({
    id: "TankServerStats",
    description:
      "Server-wide performance for a tank, averaged over tracked players. moeN/momN are holder counts among tracked players; null until the by-tank cron has coverage.",
  });

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

export const tankEconomics = z
  .object({
    buyCredits: n(),
    buyGold: n(),
    shellCost: n(),
    ammoCost: n(),
    researchXp: n(),
    totalFreeXp: n(),
  })
  .meta({
    id: "TankEconomics",
    description:
      "A tank's economics: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1.",
  });

export const tankMoe = z
  .object({ mark1: n(), mark2: n(), mark3: n() })
  .meta({
    id: "TankMarksOfExcellence",
    description:
      "The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on a tank, mirrored per region.",
  });

export const tankMastery = z
  .object({ class3: n(), class2: n(), class1: n(), ace: n() })
  .meta({
    id: "TankMarksOfMastery",
    description:
      "The XP thresholds for the 3rd/2nd/1st Class and Ace Tanker Mark of Mastery badges on a tank, mirrored per region.",
  });

// One dataset row = identity + one category. Named so both the list endpoints
// (array of these) and the per-tank endpoints (one of these) reference it.
export const tankPerfRow = z
  .object({ identity: tankIdentity, stats: tankServerStats.nullable() })
  .meta({ id: "TankPerfRow", description: "A tank's identity and server performance." });

export const tankSpecRow = z
  .object({ identity: tankIdentity, specifications: tankSpecifications.nullable() })
  .meta({ id: "TankSpecRow", description: "A tank's identity and specifications." });

export const tankEconRow = z
  .object({ identity: tankIdentity, economics: tankEconomics.nullable() })
  .meta({ id: "TankEconRow", description: "A tank's identity and economics." });

export const tankMoeRow = z
  .object({ identity: tankIdentity, moe: tankMoe.nullable() })
  .meta({ id: "TankMoeRow", description: "A tank's identity and Marks of Excellence." });

export const tankMasteryRow = z
  .object({ identity: tankIdentity, mastery: tankMastery.nullable() })
  .meta({ id: "TankMasteryRow", description: "A tank's identity and Marks of Mastery." });
