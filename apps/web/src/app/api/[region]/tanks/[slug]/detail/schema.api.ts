// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty.
import { z } from "zod";
import { TankClient } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import {
  tankConfig,
  tankCrew,
  tankFieldMods,
  tankLoadout,
  tankModuleNode,
  tankSkillTree,
  vehicleMeta,
  vehicleMode,
} from "../../vehicle.api";
// One declaration of the `TankServerStats` component, shared with the dataset
// endpoints: two zod objects carrying the same OpenAPI id would collapse onto
// whichever the generator visits last, and the SDK would document one endpoint
// with the other's shape.
import { tankServerStats } from "../../categories.api";

/** Query of `GET /{region}/tanks/{slug}/detail`. */
export const tankDetailQuery = z.object({
  // Optional, not `.default()`: next-openapi-gen serializes a defaulted param
  // as required, which would make the SDK's argument mandatory on an endpoint
  // every caller reads without one. The doc default comes from
  // `QUERY_PARAM_DEFAULTS` instead, like every other defaulted query param.
  client: z
    .enum(TankClient)
    .optional()
    .meta({
      description:
        "Which game client to read the vehicle's characteristics from. `ct` serves what the running Common Test build makes of it, so a tank can be inspected and configured the way the next update would ship it. Falls back to live when no test is running or when it leaves this vehicle alone.",
      "x-enum-source": "TANK_CLIENT",
    } as EnumMeta),
});

const topTankPlayer = z.object({
  account_id: z.number(),
  nickname: z.string(),
  clan_tag: z.string().nullable(),
  clan_color: z.string().nullable(),
  battles: z.number(),
  avg_damage: z.number(),
  winrate: z.number(),
  value: z.number().meta({ description: "The ranked metric's value." }),
  // The crests, so a player is named here exactly as on every other board.
  // Optional: this payload is cached whole, and an entry written before these
  // existed answers without them until it expires.
  is_verified: z.boolean().optional(),
  is_supporter: z.boolean().optional(),
  twitch_login: z.string().nullable().optional(),
  tournament_wins: z.number().optional(),
  tournament_featured_wins: z.number().optional(),
  tournament_best_title: z.string().nullable().optional(),
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
    configs: z.array(tankConfig).meta({
      description:
        "Every selectable module combination with its full derived specs, so the page re-renders the characteristics from the modules the user picks. Empty when the wot-src catalogue has nothing for the tank (the page shows the static stock specs).",
    }),
    loadout: tankLoadout.nullable().meta({
      description:
        "The tank's Equipment 2.0 slots and every compatible device (with effects), so the page can apply equipment to the characteristics. Null when the wot-src catalogue has nothing for the tank.",
    }),
    crew: tankCrew.nullable().meta({
      description:
        "The tank's crew composition and the crew-skill catalogue (name, icon, role, per-level spec effects), so the page can apply crew skills to the characteristics. Null when WG has no crew for the vehicle.",
    }),
    fieldMods: tankFieldMods.nullable().meta({
      description:
        "The tank's field modifications (post progression): the level steps with their stat effects and dual-modification choices. Null below tier VI or when the wot-src catalogue has nothing for the tank.",
    }),
    skillTree: tankSkillTree.nullable().meta({
      description:
        "The tank's vehicle skill tree (the tier-XI 'upgrades'): the node graph with each node's stat effects and 2D layout. Null for every tier <= X vehicle (which uses field modifications instead).",
    }),
    modes: z.array(vehicleMode).meta({
      description:
        "The alternate driving modes the vehicle can switch into (siege for Swedish TDs, rapid for wheeled vehicles), each as ratio factors over the base spec plus any gun-arc override. Empty for the vast majority of vehicles, which have no mode.",
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
    hasHistory: z.boolean().meta({
      description:
        "Whether the tank has anything on its History tab: a recorded characteristic change, or a known lifecycle event (release / dev). Drives the History tab's visibility.",
    }),
    client: z.enum(TankClient).meta({
      description:
        "Which game client these characteristics were read from. Only the vehicle's own data follows it: server stats, marks and best players always come from the region's live client, since a test server has no players to measure.",
      "x-enum-source": "TANK_CLIENT",
    } as EnumMeta),
    testVersion: z.string().nullable().meta({
      description:
        "The Common Test build that rebalances this tank, e.g. `2.4.0.5415`. Null when no test is running or when this one leaves the vehicle alone. Present whichever client the payload is for, so a caller can offer the other one.",
    }),
    rating: z
      .object({
        overall: z.number().nullable().meta({
          description: "Plain mean of the community's Overall stars, 1 to 5.",
        }),
        votes: z.number().int(),
        reviewCount: z.number().int(),
      })
      .meta({
        description:
          "The community's verdict in three figures, for the hero badge and the page's structured data. The full breakdown is on `/ratings`.",
      }),
  })
  .meta({
    id: "TankDetail",
    description:
      "Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path.",
  });
