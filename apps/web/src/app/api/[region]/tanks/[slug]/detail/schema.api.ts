// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty.
import { z } from "zod";
import { TankClient } from "@unicum.gg/shared";
import { paintLockField, type EnumMeta } from "@/services/openapi/schemas";
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
  onslaught_best_tier: z.string().nullable().optional(),
  onslaught_best_rank: z.number().nullable().optional(),
  onslaught_seasons: z.number().optional(),
  tank_id: z.number().optional().meta({
    description:
      "The vehicle the row was earned on. Only on the board read across twins (`withTwins`), where it is not always this one.",
  }),
});

const tankDetailTopByMetric = z.object({
  wn7: z.array(topTankPlayer),
  wn8: z.array(topTankPlayer),
  wnx: z.array(topTankPlayer),
  computedAt: z.coerce.date().nullable(),
});

const tankDetailTwin = z.object({
  tankId: z.number(),
  slug: z.string(),
  name: z.string(),
  players: z.number().meta({
    description: "Players the nightly pass ranked on that vehicle.",
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
    topByMetric: tankDetailTopByMetric,
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
    basedOn: z
      .object({ name: z.string(), slug: z.string() })
      .nullable()
      .meta({
        description:
          "The vehicle this one was made from, where the game client says it is one: a reissue or event variant drawing another tank's meshes, or a reskin shipping its own and pointing every hit tester at another tank's armour. Null where the vehicle stands on its own, and where the two share a name.",
      }),
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
    mechanic: z.string().nullable().meta({
      description:
        "Which mechanic the vehicle's second state is, where it has one: siege, wheeled, dualGun, twinGun, turboshaftEngine, shellParamsSwitcher or lowChargeShot. The client tags all of them the same way, so this is what tells them apart. Null for the vast majority of vehicles, which have no second state.",
    }),
    // Nullable at the use site rather than on the shared field: the generator
    // reads these objects off the AST, so an optionality folded into the
    // exported const comes out as part of the component every other endpoint
    // shares.
    paintLock: paintLockField.nullable().meta({
      description:
        "Why the game refuses to let this vehicle be dressed, null for the vast majority, which take any paint they are offered.",
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
    model: z
      .object({
        root: z.string().meta({
          description:
            "The build of the geometry mirror this vehicle should be read at, as a CDN root pinned to a commit. The viewer uses this one rather than resolving a build of its own: two answers that drift apart mean the vehicle is downloaded twice.",
        }),
        path: z.string().meta({
          description:
            "Where the vehicle's files sit under `vehicles/`. Unguessable from the code: the nation folder is not the nation the scripts name, and a quarter of the catalogue draws from another vehicle's meshes.",
        }),
        worn: z.string().nullable().meta({
          description:
            "The 3D style this vehicle is issued already wearing, where it is issued one. Most reward vehicles ship no geometry of their own, so `path` points at the tank underneath and this is the rest of the answer.",
        }),
        geometry: z.array(z.string()).meta({
          description:
            "The vehicle's meshes, as absolute URLs on the build above. Empty when the mirror would not answer for its manifest, which costs the head start and nothing else.",
        }),
        textures: z.array(z.string()).meta({
          description:
            "The maps those meshes wear, at the standard definition the hero opens on. The client's shared micro-grain is deliberately absent: it is six megabytes, every vehicle names it, and the viewer stands the tank up without it.",
        }),
      })
      .nullable()
      .meta({
        description:
          "Which build of the geometry mirror the 3D hero should read this vehicle at, so it uses the one this payload was resolved against instead of resolving its own. Two answers that drift apart mean the vehicle is downloaded twice. Null for a vehicle the mirror does not carry, which is drawn from a photograph.",
      }),
    twins: z.array(tankDetailTwin).meta({
      description:
        "The vehicles that are this one under another name: declared made from the same vehicle by the game client AND equal on every characteristic (the Dream Chaser is the SDP wz 66 Grom). Wargaming keeps a separate record for each id. Only twins with server stats, most played first. Empty for a vehicle that stands alone.",
    }),
    withTwins: z
      .object({
        topByMetric: tankDetailTopByMetric,
        serverStats: tankServerStats.nullable(),
      })
      .nullable()
      .meta({
        description:
          "`topByMetric` and `serverStats` read across this vehicle and its `twins`. A player who owns several keeps their best row, tagged with the vehicle it was earned on. Null when there are no twins.",
      }),
  })
  .meta({
    id: "TankDetail",
    description:
      "Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path.",
  });
