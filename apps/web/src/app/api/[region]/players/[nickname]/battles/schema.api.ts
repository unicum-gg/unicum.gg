// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";
import { BattleOutcome } from "@unicum.gg/core/battles/read";

/** One vehicle's whole battle, as the client's own results reported it. */
const battleVehicle = z
  .object({
    id: z.number().meta({
      description: "Battle-scoped vehicle id, the key the results are mapped by.",
    }),
    account: z.number().optional().meta({
      description: "Wargaming account id, absent for a bot.",
    }),
    team: z.number(),
    tank: z.number().meta({
      description: "`typeCompDescr` of the vehicle the account brought.",
    }),
    damage: z.number(),
    radio: z.number().meta({ description: "Damage assisted by spotting." }),
    track: z.number().meta({ description: "Damage assisted by tracking." }),
    stun: z.number().meta({ description: "Damage assisted by stunning." }),
    blocked: z.number().meta({ description: "Damage blocked by armour." }),
    received: z.number(),
    shots: z.number(),
    hits: z.number(),
    piercings: z.number(),
    spotted: z.number(),
    kills: z.number(),
    lifeTime: z.number().meta({
      description: "Seconds alive; the battle's duration when they survived it.",
    }),
    deathReason: z.number().meta({
      description:
        "`-1` when they survived, otherwise the game's own reason code, of which 0 is one.",
    }),
    capturePoints: z.number(),
    xp: z.number(),
    credits: z.number(),
    health: z.number().meta({
      description: "Hit points left, negative on the shot that overkills.",
    }),
    maxHealth: z.number(),
  })
  .meta({
    id: "BattleVehicle",
    description: "One vehicle's whole battle.",
  });

/** The vehicle a battle row names, enough to draw and to link. */
const battleTank = z
  .object({
    id: z.number().meta({
      description: "`typeCompDescr`, which is the catalogue's own tank id.",
    }),
    name: z.string(),
    shortName: z.string(),
    tier: z.number(),
    type: z.string().meta({ description: "`mediumTank`, `heavyTank`, …" }),
    nation: z.string(),
    tag: z.string().meta({
      description: "The client's own tag, which the icon is addressed by.",
    }),
    slug: z.string().nullable().meta({
      description: "Our slug for the vehicle page, null when it has none.",
    }),
  })
  .meta({ id: "BattleTank", description: "A vehicle as a battle row names it." });

/** What a battle earned the account that reported it. */
const battleEconomy = z
  .object({
    creditsBase: z.number().optional(),
    creditsBooster: z.number().optional(),
    creditsEvent: z.number().optional(),
    creditsOrder: z.number().optional(),
    creditsPenalty: z.number().optional(),
    creditsCompensation: z.number().optional(),
    creditsSubtotal: z.number().optional(),
    repairCost: z.number().optional(),
    ammoCost: z.number().optional(),
    suppliesCost: z.number().optional(),
    credits: z.number().optional(),
    xpBase: z.number().optional(),
    xpBooster: z.number().optional(),
    xpEvent: z.number().optional(),
    xpPremiumVehicle: z.number().optional(),
    xpPenalty: z.number().optional(),
    xp: z.number().optional(),
    freeXp: z.number().optional(),
    crewXp: z.number().optional(),
    bonds: z.number().optional(),
    bondsBase: z.number().optional(),
    premium: z.boolean().optional(),
  })
  .meta({
    id: "BattleEconomy",
    description:
      "Credits, experience and bonds as the game's own Detailed Report breaks them down. Every field is absent when it is zero.",
  });

/** One battle, read as a single player's line through it. */
export const playerBattle = z
  .object({
    id: z.string().meta({
      description:
        "The game's own battle id. A string, not a number: it runs to 19 digits, past what JSON carries.",
    }),
    startedAt: z.string().meta({
      description:
        "When the battle started, from the game's own clock rather than our receipt.",
      format: "date-time",
    }),
    map: z.string().meta({
      description: "The arena's name, `45_north_america`, not its display title.",
    }),
    mapBounds: z
      .object({
        bottomLeft: z.object({ x: z.number(), z: z.number() }),
        upperRight: z.object({ x: z.number(), z: z.number() }),
      })
      .nullable()
      .meta({
        description:
          "The arena's extent in metres, which is what places a replay's coordinates on the minimap.",
      }),
    mapImage: z.string().nullable().meta({
      description:
        "The minimap this arena is actually played on, resolved against the maps catalogue. An Onslaught night arena is played on its own `_comp7` image rather than the daylight one shipped under its name.",
    }),
    gameplay: z.string().nullable().meta({
      description: "`ctf`, `domination`, `assault`… null when none was named.",
    }),
    battleType: z.number().meta({
      description: "The game's own `bonusType`: 1 random, 43 onslaught, 20/21 skirmishes.",
    }),
    duration: z.number().nullable().meta({ description: "Seconds." }),
    team: z.number().meta({ description: "The player's own team." }),
    outcome: z.enum(BattleOutcome).meta({
      description: "Win, loss or draw for this player; unknown when no winner was named.",
    }),
    tank: battleTank.nullable().meta({
      description:
        "The vehicle they brought, named. Null for one the catalogue does not carry, which is what an unreleased or withdrawn vehicle looks like.",
    }),
    own: battleVehicle.meta({
      description: "This player's own line through the battle.",
    }),
    rating: z
      .record(z.string(), z.number().nullable())
      .meta({
        description:
          "What this one battle scored, keyed by metric (`wn7`, `wn8`, `wnx`). The same accumulators the lifetime figures use, fed a single battle: the ratings are defined per battle and only ever averaged. Null for a metric whose expected values do not carry this vehicle.",
      }),
    players: z.number().meta({
      description: "Accounts the battle named, bots excluded.",
    }),
    reporters: z.number().meta({
      description:
        "How many clients reported this battle. Two means two of our players were in it.",
    }),
    personal: battleEconomy.nullable().meta({
      description:
        "What the battle earned this player, present only when it was this account's own client that reported it. The results carry an economy for the reporting client alone, so a battle somebody else uploaded has none for them at any price.",
    }),
  })
  .meta({
    id: "PlayerBattle",
    description: "One battle, as a single player's line through it.",
  });

/** Response of `GET /{region}/players/{nickname}/battles`. */
export const PlayerBattlesResponse = z
  .object({
    accountId: z.number(),
    nickname: z.string().meta({
      description: "The nickname this account carries now, which may differ from the one asked for.",
    }),
    battles: z.array(playerBattle).meta({
      description: "Newest first.",
    }),
  })
  .meta({
    id: "PlayerBattlesResponse",
    description:
      "A player's most recent battles, as the clients that played them reported.",
  });
