// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

// Spelled out here rather than imported from the shared types: the generator
// only expands a schema it parsed in this file. The shapes are the client's
// own, so the comments say what the game means rather than what the field is
// called.

const loadoutModule = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .meta({
    id: "LoadoutModule",
    description:
      "A fitted module. `id` is the game's compact descriptor, which is its identity; `name` is the client's own name for it and is scoped to a nation.",
  });

const loadoutShell = z
  .object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    premium: z.boolean(),
    count: z.number(),
  })
  .meta({
    id: "LoadoutShell",
    description:
      "One kind of round and how many of them are loaded. `type` is the game's own kind (ARMOR_PIERCING, ARMOR_PIERCING_CR, HOLLOW_CHARGE, HIGH_EXPLOSIVE) and `premium` means it is bought with gold.",
  });

const ammoLayout = z
  .object({
    shells: z.array(loadoutShell),
    consumables: z.array(z.string().nullable()),
  })
  .meta({
    id: "LoadoutAmmoLayout",
    description:
      "One shells-and-consumables setup. `consumables` is indexed by slot, so an empty slot is null rather than a shorter list.",
  });

const devicesLayout = z
  .object({
    optDevices: z.array(z.string().nullable()),
    boosters: z.array(z.string().nullable()),
  })
  .meta({
    id: "LoadoutDevicesLayout",
    description:
      "One equipment-and-directives setup. Both lists are indexed by slot, so an empty slot is null.",
  });

const ammoGroup = z
  .object({
    active: z.number(),
    layouts: z.array(ammoLayout),
  })
  .meta({
    id: "LoadoutAmmoSetups",
    description:
      "The shells-and-consumables group. `active` indexes `layouts`. A vehicle only has a second layout once its owner unlocked the switch through post progression.",
  });

const devicesGroup = z
  .object({
    active: z.number(),
    layouts: z.array(devicesLayout),
  })
  .meta({
    id: "LoadoutDevicesSetups",
    description:
      "The equipment-and-directives group, with its own active index. It moves independently of the ammunition group, so a vehicle can be on its second ammunition setup and its first equipment setup at once.",
  });

const loadoutCrewMember = z
  .object({
    role: z.string(),
    skills: z.array(z.string()),
  })
  .meta({
    id: "LoadoutCrewMember",
    description:
      "One crew member: their role (commander, gunner, driver, radioman, loader) and the skills they have been taught, in the order they were learned.",
  });

const loadoutProgression = z
  .object({
    level: z.number().nullable(),
    pairs: z.array(z.object({ name: z.string(), side: z.string() })),
    tree: z.array(z.number()),
  })
  .meta({
    id: "LoadoutProgression",
    description:
      "Field modifications: the level reached and the side taken of each pair. A tier XI vehicle has a skill tree instead, and carries its received steps in `tree` with `level` null and `pairs` empty.",
  });

export const PlayerTankLoadoutResponse = z
  .object({
    loadout: z
      .object({
        tankId: z.number(),
        modules: z
          .object({
            gun: loadoutModule.nullable(),
            turret: loadoutModule.nullable(),
            engine: loadoutModule.nullable(),
            chassis: loadoutModule.nullable(),
            radio: loadoutModule.nullable(),
          })
          .nullable(),
        crew: z.array(loadoutCrewMember),
        progression: loadoutProgression.nullable(),
        setups: z
          .object({
            ammo: ammoGroup.nullable(),
            devices: devicesGroup.nullable(),
          })
          .nullable(),
        updatedAt: z.iso.datetime(),
      })
      .nullable(),
  })
  .meta({
    id: "PlayerTankLoadoutResponse",
    description:
      "How this player has set this vehicle up. Null when we hold nothing: Wargaming publishes none of this, so a loadout exists only because that player runs the unicum.gg mod, which reads it from their own client. Null is also the answer for a player who asked for their loadouts not to be shown.",
  });
