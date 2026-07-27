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

const moduleShell = z.object({
  type: z.string(),
  damage: z.number(),
  penetration: z.number(),
});

const moduleStats = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gun"),
    reloadTime: z.number(),
    fireRate: z.number(),
    aimTime: z.number(),
    dispersion: z.number(),
    maxAmmo: z.number(),
    moveDownArc: z.number(),
    moveUpArc: z.number(),
    traverseSpeed: z.number(),
    shells: z.array(moduleShell),
  }),
  z.object({
    kind: z.literal("turret"),
    armorFront: z.number(),
    armorSides: z.number(),
    armorRear: z.number(),
    hp: z.number(),
    viewRange: z.number(),
    traverseSpeed: z.number(),
  }),
  z.object({
    kind: z.literal("engine"),
    power: z.number(),
    fireChance: z.number(),
  }),
  z.object({
    kind: z.literal("chassis"),
    loadLimit: z.number(),
    traverseSpeed: z.number(),
  }),
  z.object({ kind: z.literal("radio"), signalRange: z.number() }),
]);

const moduleTankRef = z.object({
  tankId: z.number(),
  slug: z.string(),
  name: z.string(),
  tier: z.number(),
  type: z.string(),
  tag: z.string(),
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
  stats: moduleStats.nullable().meta({
    description:
      "Reference stats for the module (WG default profile), tagged by class via `kind`.",
  }),
  tanks: z.array(moduleTankRef).meta({
    description: "Every vehicle that can mount this module, highest tier first.",
  }),
});

const tankConfig = z.object({
  modules: z
    .object({
      gun: z.number().nullable(),
      turret: z.number().nullable(),
      engine: z.number().nullable(),
      chassis: z.number().nullable(),
      radio: z.number().nullable(),
    })
    .meta({
      description:
        "The WG module ids mounted in this configuration, one per slot (null when the tank has no module of that class).",
    }),
  specs: z.looseObject({}).meta({
    description:
      "The full combat specification for this module combination, same shape as the top-level `specs` row.",
  }),
});

const equipmentEffect = z.object({
  attribute: z.string(),
  type: z.enum(["mul", "add"]),
  base: z.number(),
  bonus: z.number().meta({
    description: "Value applied when the slot's category matches (Equipment 2.0).",
  }),
});

const loadoutEquipment = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().meta({
    description: "The device's in-game description, from the client localization.",
  }),
  image: z.string().nullable(),
  grade: z
    .enum(["standard", "bond", "bounty", "bountyUpgraded", "experimental"])
    .meta({
      description:
        "Acquisition grade: standard (credits), bond (improved), bounty, bountyUpgraded or experimental.",
    }),
  icon: z.string().meta({
    description: "wot-src family icon; the directive/equipment family key.",
  }),
  categories: z.array(z.string()).meta({
    description: "Equipment 2.0 categories (firepower, mobility, survivability, stealth).",
  }),
  effects: z.array(equipmentEffect),
});

const equipmentSlot = z.object({
  category: z.string().nullable().meta({
    description: "The slot's category (null for a legacy universal slot).",
  }),
  role: z.boolean().meta({ description: "True for the swappable role slot." }),
  roleOptions: z.array(z.string()).optional(),
});

const loadoutDirective = z.object({
  key: z.string(),
  equipmentIcon: z.string().meta({
    description:
      "The equipment family (its `icon`) an equipment directive enhances; empty for crew directives. Any mounted device of that family enables it.",
  }),
  name: z.string(),
  description: z.string().meta({
    description: "The directive's in-game description, from the client localization.",
  }),
  image: z.string().nullable(),
  attribute: z.string(),
  type: z.enum(["mul", "add"]),
  value: z.number(),
  crew: z.boolean().meta({
    description:
      "A crew directive (boosts a crew skill, always mountable) rather than an equipment directive.",
  }),
  boostKind: z.enum(["level", "efficiency"]).nullable().meta({
    description:
      "Crew directives: scales the boosted skill's effective level or its efficiency.",
  }),
  boostValue: z.number(),
  effects: z
    .array(z.object({ attribute: z.string(), value: z.number() }))
    .meta({ description: "The boosted skill's per-level spec effects." }),
  camouflage: z.boolean(),
  commander: z.boolean(),
});

const loadoutConsumable = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().meta({
    description: "The consumable's in-game description, from the client localization.",
  }),
  image: z.string().nullable(),
  effects: z.array(
    z.object({ attribute: z.string(), value: z.number() }),
  ).meta({
    description:
      "Passive multiplicative effects on a characteristic (fuel, extinguisher, ...); empty for repair/first-aid kits and crew rations.",
  }),
});

const fieldModItem = z.object({
  key: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  effects: z.array(
    z.object({
      attribute: z.string(),
      type: z.enum(["mul", "add"]),
      value: z.number(),
    }),
  ),
});

const fieldModStep = z.object({
  level: z.number(),
  kind: z.enum(["feature", "modification", "pair"]),
  feature: z
    .object({
      key: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      image: z.string().nullable(),
    })
    .nullable(),
  modification: fieldModItem.nullable(),
  pair: z
    .object({ key: z.string(), first: fieldModItem, second: fieldModItem })
    .nullable(),
});

const tankFieldMods = z.object({
  treeKey: z.string().meta({
    description: "The post-progression tree: the vehicle's role or its own special tree.",
  }),
  steps: z.array(fieldModStep),
});

const vehicleMode = z.object({
  kind: z.enum(["siege", "rapid"]),
  switchOnTime: z.number(),
  switchOffTime: z.number(),
  factors: z.array(
    z.object({
      attribute: z.string(),
      type: z.enum(["mul", "add"]),
      value: z.number(),
    }),
  ),
  depression: z.number().nullable(),
  elevation: z.number().nullable(),
});

const skillNode = z.object({
  id: z.number(),
  type: z.string().meta({
    description: "Importance/size tier: common | major | final, or special (feature node).",
  }),
  category: z.string().meta({
    description: "firepower | mobility | survivability | mechanics; empty for feature nodes.",
  }),
  isFeature: z.boolean(),
  name: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  effects: z.array(
    z.object({
      attribute: z.string(),
      type: z.enum(["mul", "add"]),
      value: z.number(),
    }),
  ),
  position: z.tuple([z.number(), z.number()]).meta({
    description: "The client's 2D layout coordinates (x, y).",
  }),
  unlocks: z.array(z.number()).meta({
    description: "Forward-edge node ids this node unlocks.",
  }),
  unlockStrategyAny: z.boolean().meta({
    description: "Reachable as soon as ANY predecessor is unlocked (else all).",
  }),
});

const tankSkillTree = z.object({
  rootStep: z.number(),
  nodes: z.array(skillNode),
});

const tankLoadout = z.object({
  slots: z.array(equipmentSlot),
  equipment: z.array(loadoutEquipment),
  directives: z.array(loadoutDirective).meta({
    description:
      "Directives (battle boosters) that enhance a compatible device, each tied to its equipment; applied on top of the mounted equipment.",
  }),
  consumables: z.array(loadoutConsumable).meta({
    description:
      "The consumables the vehicle can mount (repair/first-aid kits, extinguishers, food, fuel, ...) in three generic slots.",
  }),
});

const crewSkill = z.object({
  key: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  description: z.string(),
  isPerk: z.boolean(),
  role: z.string().meta({
    description: "Owning role (commander, gunner, ...) or 'common' (universal).",
  }),
  effects: z
    .array(z.object({ attribute: z.string(), value: z.number() }))
    .meta({
      description:
        "Passive per-skill-level effects on a displayed characteristic; empty for situational or non-spec skills (still shown, no delta).",
    }),
  crewLevel: z.number().meta({
    description:
      "Crew-training-level bonus in level points (Brothers in Arms = 5), 0 for a normal skill; applied to every crew-affected stat, not a single one.",
  }),
  camouflage: z.boolean().meta({
    description:
      "The Camouflage skill: scales the camo values by 0.57 + 0.43 * level, applied to camo rather than a single characteristic.",
  }),
});

const crewMember = z.object({
  memberId: z.string(),
  roles: z.array(z.string()),
  image: z.string().nullable().meta({
    description: "The member's WG tankopedia nation portrait, by slot position.",
  }),
  roleBadge: z.string().nullable().meta({
    description: "The role badge overlaid on the portrait (its primary role).",
  }),
  skills: z.array(z.string()).meta({
    description: "Skill keys this member can learn (its roles' + universal).",
  }),
});

const tankCrew = z.object({
  members: z.array(crewMember),
  skills: z.array(crewSkill),
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
  })
  .meta({
    id: "TankDetail",
    description:
      "Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path.",
  });
