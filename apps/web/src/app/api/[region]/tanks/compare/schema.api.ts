// Co-located response schema for this route. The `.api.ts` suffix is required:
// next-openapi-gen only scans `route.ts` plus `.ts` files whose name contains
// "api", so a plain `schema.ts` would be found by name but built empty.
import { z } from "zod";
import { TankClient } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import {
  crewMember,
  crewSkill,
  equipmentSlot,
  loadoutConsumable,
  loadoutDirective,
  loadoutEquipment,
  tankConfig,
  tankFieldMods,
  tankModuleNode,
  tankSkillTree,
  vehicleMeta,
  vehicleMode,
} from "../vehicle.api";
import { tankServerStats } from "../categories.api";

const compareCatalog = z
  .object({
    equipment: z.array(loadoutEquipment),
    directives: z.array(loadoutDirective),
    consumables: z.array(loadoutConsumable),
    crewSkills: z.array(crewSkill),
  })
  .meta({
    id: "TankCompareCatalog",
    description:
      "The mountable catalogues shared by the compared vehicles, described once: every device, directive, consumable and crew skill any of them can mount. Each vehicle references them by key.",
  });

const compareVehicle = z
  .object({
    tankId: z.number(),
    slug: z.string().meta({
      description:
        "Canonical slug. Callers that reached a vehicle through a legacy id or wrong-case slug should redirect to it. It carries no client suffix: `client` below says which one this column is.",
    }),
    client: z.enum(TankClient).meta({
      description:
        "The game client this column was read on. `ct` when the query asked for it, and always for a vehicle that exists only on the test client.",
      "x-enum-source": "TANK_CLIENT",
    } as EnumMeta),
    testVersion: z.string().nullable().meta({
      description:
        "The Common Test build available for this vehicle, e.g. `2.4.0.5415`. Null when no test is running or when it leaves the vehicle alone.",
    }),
    meta: vehicleMeta,
    specs: z.looseObject({}).nullable().meta({
      description:
        "The vehicle's top-configuration combat specification, same shape as the `/specifications` endpoints.",
    }),
    modules: z.array(tankModuleNode),
    configs: z.array(tankConfig).meta({
      description:
        "Every selectable module combination with its derived specs, so a column re-renders its characteristics from the modules picked on it.",
    }),
    modes: z.array(vehicleMode),
    mechanic: z.string().nullable().meta({
      description:
        "Which mechanic the vehicle's second state is, where it has one: siege, wheeled, dualGun, twinGun, turboshaftEngine, shellParamsSwitcher or lowChargeShot. Null for the vast majority of vehicles, which have no second state.",
    }),
    loadout: z
      .object({
        slots: z.array(equipmentSlot),
        equipmentKeys: z.array(z.string()),
        directiveKeys: z.array(z.string()),
        consumableKeys: z.array(z.string()),
      })
      .nullable()
      .meta({
        description:
          "The vehicle's equipment slots plus the catalogue keys it can mount, resolved against `catalog`. Null when the wot-src catalogue has nothing for it.",
      }),
    crew: z
      .object({ members: z.array(crewMember), skillKeys: z.array(z.string()) })
      .nullable()
      .meta({
        description:
          "The vehicle's crew composition plus the skill keys its members can train, resolved against `catalog.crewSkills`.",
      }),
    fieldMods: tankFieldMods.nullable(),
    skillTree: tankSkillTree.nullable(),
    stats: tankServerStats.nullable(),
    moe: z
      .object({ mark1: z.number(), mark2: z.number(), mark3: z.number() })
      .nullable(),
    mastery: z
      .object({
        class3: z.number(),
        class2: z.number(),
        class1: z.number(),
        ace: z.number(),
      })
      .nullable(),
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
  })
  .meta({
    id: "TankCompareVehicle",
    description:
      "One column of a comparison: a vehicle's identity, what it is made of, what it can mount, and its server-average performance.",
  });

const specRange = z.object({ low: z.number(), high: z.number() });

/** Response of `GET /{region}/tanks/compare`. */
export const TanksCompareResponse = z
  .object({
    vehicles: z.array(compareVehicle).meta({
      description:
        "The compared vehicles, in the requested order. A slug the catalogue doesn't know is dropped rather than failing the request, so the array can be shorter than the query.",
    }),
    catalog: compareCatalog,
    ranges: z.record(z.string(), specRange).meta({
      description:
        "Where each specification sits across the whole vehicle catalogue, as its 5th (`low`) and 95th (`high`) percentile, keyed by specification field. Percentiles rather than min/max so a single outlier vehicle doesn't flatten the scale. Lets a client read a value as a position in the catalogue (and score a vehicle per category) rather than as a bare number.",
    }),
  })
  .meta({
    id: "TanksCompare",
    description:
      "Everything a side-by-side vehicle comparison renders: each vehicle's configurable data, the mountable catalogues they share, and the catalogue-wide spread of every characteristic.",
  });
