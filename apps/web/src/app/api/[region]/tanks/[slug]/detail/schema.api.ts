// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty.
import { z } from "zod";

const vehicleMeta = z
  .object({
    tier: z.number(),
    type: z.string(),
    nation: z.string(),
    name: z.string(),
    shortName: z.string(),
    tag: z.string(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    role: z.string().nullable(),
    contourIcon: z.string().nullable(),
    bigIcon: z.string().nullable(),
  })
  .meta({ id: "VehicleMeta", description: "The tank's catalogue identity." });

const topTankPlayer = z.object({
  account_id: z.number(),
  nickname: z.string(),
  clan_tag: z.string().nullable(),
  clan_color: z.string().nullable(),
  battles: z.number(),
  avg_damage: z.number(),
  winrate: z.number(),
  value: z.number().meta({ description: "The ranked metric's value." }),
});

const tankServerStats = z
  .object({
    players: z.number(),
    avg_battles: z.number(),
    total_battles: z.number().nullable(),
    avg_damage: z.number(),
    winrate: z.number(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    player_wr: z.number().nullable(),
    avg_spots: z.number().nullable(),
    avg_assist: z.number().nullable(),
    kdr: z.number().nullable(),
    hit_pct: z.number().nullable(),
    pen_pct: z.number().nullable(),
    avg_blocked: z.number().nullable(),
    survival: z.number().nullable(),
    moe1: z.number().nullable(),
    moe2: z.number().nullable(),
    moe3: z.number().nullable(),
    mom_class3: z.number().nullable(),
    mom_class2: z.number().nullable(),
    mom_class1: z.number().nullable(),
    mom_ace: z.number().nullable(),
  })
  .meta({
    id: "TankServerStats",
    description: "Server-average performance across tracked players.",
  });

const tankModuleNode = z.object({
  moduleId: z.number(),
  type: z.string().meta({
    description:
      "WG module class: vehicleChassis, vehicleTurret, vehicleGun, vehicleEngine or vehicleRadio.",
  }),
  name: z.string(),
  tier: z.number().nullable(),
  image: z.string().nullable(),
  isDefault: z
    .boolean()
    .meta({ description: "True for the stock module the tank ships with." }),
  priceXp: z.number(),
  priceCredit: z.number(),
  nextModules: z.array(z.number()).meta({
    description:
      "Module ids this one unlocks (edges may cross classes, e.g. a turret unlocking a gun).",
  }),
  nextTanks: z.array(z.number()).meta({
    description: "Vehicle ids this module's research opens up.",
  }),
});

const researchPathItem = z.object({
  tankId: z.number(),
  slug: z.string(),
  meta: vehicleMeta,
  researchXp: z.number().nullable(),
  buyCredits: z.number().nullable(),
});

/** Response of `GET /{region}/tanks/{slug}/detail`: everything the tank page
 * renders in one payload. */
export const TankDetailResponse = z
  .object({
    tankId: z.number(),
    slug: z.string().meta({
      description:
        "Canonical slug. Callers that reached the tank through a legacy id or wrong-case slug should redirect to it.",
    }),
    meta: vehicleMeta,
    topByMetric: z.object({
      wn7: z.array(topTankPlayer),
      wn8: z.array(topTankPlayer),
      wnx: z.array(topTankPlayer),
      computedAt: z.coerce.date().nullable(),
    }),
    serverStats: tankServerStats.nullable(),
    wn8Expected: z
      .object({
        expDamage: z.number(),
        expSpot: z.number(),
        expFrag: z.number(),
        expDef: z.number(),
        expWinRate: z.number(),
      })
      .nullable(),
    wnxExpected: z
      .object({
        damage: z.number(),
        frags: z.number(),
        spots: z.number(),
        assist: z.number(),
      })
      .nullable(),
    // The full combat specification row; the same shape the dedicated
    // `/specifications` endpoints document, kept open here.
    specs: z.looseObject({}).nullable(),
    moe: z
      .object({ mark1: z.number(), mark2: z.number(), mark3: z.number() })
      .nullable(),
    mom: z
      .object({
        class3: z.number(),
        class2: z.number(),
        class1: z.number(),
        ace: z.number(),
      })
      .nullable(),
    researchPath: z
      .object({
        lineage: z.array(researchPathItem),
        next: z.array(researchPathItem),
      })
      .nullable(),
    modules: z.array(tankModuleNode).meta({
      description:
        "The module research DAG (nodes with unlock edges), in-game row order (gun, turret, engine, suspension, radio) then XP cost. Empty for tanks WG's Tankopedia doesn't detail.",
    }),
    moeHistory: z.array(
      z.object({
        day: z.string(),
        mark1: z.number(),
        mark2: z.number(),
        mark3: z.number(),
      }),
    ),
    momHistory: z.array(
      z.object({
        day: z.string(),
        class3: z.number(),
        class2: z.number(),
        class1: z.number(),
        ace: z.number(),
      }),
    ),
  })
  .meta({
    id: "TankDetail",
    description:
      "Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path.",
  });
