// Shared vehicle-configuration schemas for the /tanks endpoints: what a vehicle
// is made of (modules, module combinations) and what can be mounted on it
// (equipment, directives, consumables, crew skills, field modifications, skill
// tree, driving modes). The tank detail payload nests them per vehicle; the
// comparison hoists the mountable catalogues out of its columns and describes
// them once. Kept here so both read the same shapes rather than two copies that
// drift. `.api.ts` so next-openapi-gen scans it.
import { z } from "zod";

export const vehicleMeta = z
  .object({
    tier: z.number(),
    type: z.string(),
    nation: z.string(),
    name: z.string(),
    shortName: z.string(),
    tag: z.string(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    isCommonTest: z
      .boolean()
      .meta({ description: "Only on the Common Test client, not yet released." }),
    isHidden: z.boolean().meta({
      description:
        "Not a vehicle at all (training bot, story-mode prop). Always false here: these are excluded from the catalogue.",
    }),
    variant: z.string().nullable().meta({
      description:
        "The parallel catalogue this vehicle comes from, spelled as the suffix its name ends with (\"IGR\" for the retired cybercafe reissues). Null for a normal vehicle.",
    }),
    role: z.string().nullable(),
    contourIcon: z.string().nullable(),
    bigIcon: z.string().nullable(),
  })
  .meta({ id: "VehicleMeta", description: "The tank's catalogue identity." });

export const moduleShell = z.object({
  type: z.string(),
  damage: z.number(),
  penetration: z.number(),
});

export const moduleStats = z.discriminatedUnion("kind", [
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

export const moduleTankRef = z.object({
  tankId: z.number(),
  slug: z.string(),
  name: z.string(),
  tier: z.number(),
  type: z.string(),
  tag: z.string(),
});

export const tankModuleNode = z.object({
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

export const tankConfig = z.object({
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

export const equipmentEffect = z.object({
  attribute: z.string(),
  type: z.enum(["mul", "add"]),
  base: z.number(),
  bonus: z.number().meta({
    description: "Value applied when the slot's category matches (Equipment 2.0).",
  }),
});

export const loadoutEquipment = z.object({
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

export const equipmentSlot = z.object({
  category: z.string().nullable().meta({
    description: "The slot's category (null for a legacy universal slot).",
  }),
  role: z.boolean().meta({ description: "True for the swappable role slot." }),
  roleOptions: z.array(z.string()).optional(),
});

export const loadoutDirective = z.object({
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

export const loadoutConsumable = z.object({
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

export const fieldModItem = z.object({
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

export const fieldModStep = z.object({
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

export const tankFieldMods = z.object({
  treeKey: z.string().meta({
    description: "The post-progression tree: the vehicle's role or its own special tree.",
  }),
  steps: z.array(fieldModStep),
});

export const vehicleMode = z.object({
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

export const skillNode = z.object({
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

export const tankSkillTree = z.object({
  rootStep: z.number(),
  nodes: z.array(skillNode),
});

export const tankLoadout = z.object({
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

export const crewSkill = z.object({
  key: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  // Kept non-null on purpose: every skill has a description in the client loc
  // (`shortDescription` or `alt/description`), so a null here is a resolution bug
  // worth the dev-time jsonResponse warning, not a valid state to wave through.
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

export const crewMember = z.object({
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

export const tankCrew = z.object({
  members: z.array(crewMember),
  skills: z.array(crewSkill),
});
