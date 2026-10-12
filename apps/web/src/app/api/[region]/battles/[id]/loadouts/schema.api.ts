import * as z from "zod";

/**
 * A battle's loadouts, already named and pictured.
 *
 * Unusual for this API, which otherwise serves data and leaves presentation to
 * the page. Two things force it here and both are worth stating, because the
 * obvious alternatives are each broken in their own way.
 *
 * The battle's own endpoint cannot carry these words. It is cached in a SHARED
 * cache for an hour, since a battle never changes once it is played; put a
 * translated name in it and the next reader gets the previous reader's
 * language. So this endpoint exists beside it, and varies on the language.
 *
 * And the page cannot translate them itself. `game/equipment` and
 * `game/crew-perks` are twenty-one kilobytes that would ride on every page of
 * the site to name a loadout, so they are deliberately stripped before the
 * dictionaries cross the wire, and a client component that reads one gets its
 * key back. The garage's loadout panel gets around that by being rendered on
 * the server; a battle's cannot, because the battle a reader opens is fetched
 * in their browser and there is no server step to hang it on.
 *
 * So the resolution happens here, where the locale and the catalogues both
 * exist, and what reaches the page is finished text and finished URLs.
 */

/** One slot, named and pictured, or empty. */
export const BattleLoadoutSlot = z.object({
  name: z.string().nullable().meta({
    description:
      "The item's name in the reader's language, or null for a free slot. Position is kept, so a free slot is an entry rather than a gap: a device's grade and category depend on the slot it sits in.",
  }),
  image: z.string().nullable().meta({
    description:
      "The item's picture, or null where Wargaming publishes none. A named slot with no picture is drawn as its name, not as a hole.",
  }),
  overlay: z.string().nullable().meta({
    description:
      "The grade mark drawn in the corner, for a device that has one, or null.",
  }),
});

/** One kind of round loaded. */
export const BattleLoadoutShell = z.object({
  kind: z.string().meta({
    description: "AP, APCR, HEAT or HE, in the reader's language.",
  }),
  count: z.number().meta({ description: "How many were loaded." }),
  premium: z.boolean().meta({ description: "Whether the round costs gold." }),
  image: z.string().meta({ description: "The round's icon." }),
});

/** One crew seat, with what it was taught. */
export const BattleLoadoutCrew = z.object({
  role: z.string().meta({
    description: "The seat, in the reader's language: commander, gunner, driver…",
  }),
  roleImage: z.string().nullable().meta({ description: "The seat's badge." }),
  skills: z
    .array(
      z.object({
        name: z.string(),
        image: z.string(),
      }),
    )
    .meta({
      description:
        "The skills this seat carries, taught or granted by its role, in the order they were learned.",
    }),
});

/** One vehicle's loadout for one life. */
export const BattleLoadoutPanel = z.object({
  vehicle: z.number().meta({
    description:
      "The battle-scoped vehicle id, which is how a panel is matched to a participant.",
  }),
  life: z.number().meta({
    description:
      "Counted from zero, in the order the lives were played. Always zero outside a mode with respawns.",
  }),
  optDevices: z.array(BattleLoadoutSlot),
  boosters: z.array(BattleLoadoutSlot),
  consumables: z.array(BattleLoadoutSlot),
  shells: z.array(BattleLoadoutShell),
  fieldMods: z.array(BattleLoadoutSlot).meta({
    description:
      "The field modifications this vehicle carried, in the tree's own order. Present far more often than the rest: a recording carries these for everyone who has any.",
  }),
  crew: z.array(BattleLoadoutCrew),
});

/** Response of `GET /{region}/battles/{id}/loadouts`. */
export const BattleLoadoutsResponse = z.object({
  panels: z.array(BattleLoadoutPanel).meta({
    description:
      "One panel per vehicle per life, for the vehicles a recording of this battle could speak for: the player whose client recorded it, and any team mate they followed after dying. Empty for a battle with no recording, which is most of them. Nothing is ever known this way about the other team, because the server strips the devices out of every other vehicle's public information before it is broadcast.",
  }),
});
