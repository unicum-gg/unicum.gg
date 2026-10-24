// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the Loadouts tab parses with it.
import { z } from "zod";
import { LoadoutItemKind, LoadoutMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { answerLanguageField } from "@/services/openapi/locale";
import { playerBattle } from "@/app/api/[region]/players/[nickname]/battles/schema.api";

export const loadoutsQuery = z.object({
  // Written out in full rather than pulled from a shared const, and
  // `.optional()`, never `.default()`: next-openapi-gen reads these off the
  // AST, a const reference comes out as a dangling `$ref`, and a `.default()`
  // is dropped.
  // Its default is written in the description rather than in
  // `QUERY_PARAM_DEFAULTS`, which is keyed by parameter name across the whole
  // API, and `mode` already names a different set on the player endpoints.
  mode: z
    .enum(LoadoutMode)
    .optional()
    .meta({
      description:
        "Which battle mode to count, random by default. Modes are never pooled: each has its own economy and its own idea of a good result, so every figure in the response belongs to the one asked for. The modes field says which ones hold anything for this vehicle.",
      "x-enum-source": "LOADOUT_MODE",
    } as EnumMeta),
  // Names the fitted items of the best battles, which are drawn with their
  // names on hover. `.optional()` here rather than in the shared field, or the
  // generator documents it as required.
  language: answerLanguageField.optional(),
});

const ratings = z.object({
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
});

const performance = z
  .object({
    players: z.number().int().meta({
      description: "Different players among the battles behind this row.",
    }),
    battles: z.number().int().meta({ description: "Battles behind this row." }),
    winrate: z.number().nullable().meta({
      description: "Battles won over battles, 0 to 1. A draw is not a win.",
    }),
    playerWinrate: z.number().nullable().meta({
      description:
        "The same players' overall account win rate, weighted by their battles under this row, over the players a win rate is held for. The difference with winrate says how the setup plays against how good its players are in general.",
    }),
    avgDamage: z.number().nullable().meta({ description: "Damage dealt per battle." }),
    avgAssist: z.number().nullable().meta({
      description: "Damage dealt by others on this player's spotting or tracking, per battle.",
    }),
    rating: ratings.meta({
      description:
        "WN7, WN8 and WNX over these battles, with the site's own formulas and expected values.",
    }),
    playerRating: ratings.meta({
      description:
        "The same players' overall account ratings, weighted by their battles under this row, over the players a rating is held for.",
    }),
  })
  .meta({
    id: "LoadoutPerformance",
    description:
      "How the battles behind a row went, beside the same players' usual figures in the vehicle. Present at any size: below five players a row describes the people more than the setup, which a caller should say rather than hide. Each figure is the result of the battles the setup was actually fitted in, which still says who runs it as much as what it does.",
  });

const itemUsage = z
  .object({
    kind: z.enum(LoadoutItemKind).meta({
      description: "Which family the fitted item belongs to.",
      "x-enum-source": "LOADOUT_ITEM_KIND",
    } as EnumMeta),
    key: z.string().meta({
      description:
        "The client's own key, e.g. improvedVentilation_tier1. A field modification is keyed by the catalogue key of the side of the pair taken.",
    }),
    count: z.number().int().meta({
      description: "Players who ran it in at least one counted battle.",
    }),
    battles: z.number().int().meta({ description: "Battles it was fitted in." }),
    share: z.number().meta({
      description:
        "count over the sample, 0 to 1. A player who ran two setups counts under both, so a family's shares need not add up to one.",
    }),
    performance,
  })
  .meta({ id: "LoadoutItemUsage" });

const crewSkillUsage = z
  .object({
    role: z.string(),
    skill: z.string(),
    count: z.number().int().meta({
      description: "Players whose crew had this seat trained in it.",
    }),
    battles: z.number().int().meta({ description: "Battles fought with it." }),
    crews: z.number().int().meta({
      description: "Players whose crew has this seat at all, which share is over.",
    }),
    share: z.number().meta({
      description:
        "count over crews rather than over the whole sample, since crews are not all the same size.",
    }),
    performance,
  })
  .meta({ id: "LoadoutCrewSkillUsage" });

const popularSetup = z
  .object({
    kind: z.enum(LoadoutItemKind).meta({
      description:
        "Which family this combines: equipment and consumables, filled as a set of three, or field mods, the whole tree of choices in the tree's own order.",
      "x-enum-source": "LOADOUT_ITEM_KIND",
    } as EnumMeta),
    items: z.array(z.string()).meta({
      description:
        "What is fitted, in the slot order most of its battles used. The same three are one setup however the slots were arranged.",
    }),
    count: z.number().int().meta({
      description: "Players who ran it in at least one counted battle.",
    }),
    battles: z.number().int(),
    share: z.number(),
    performance,
  })
  .meta({ id: "LoadoutPopularSetup" });

const topPlayer = z
  .object({
    nickname: z.string(),
    accountId: z.number().int(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    isVerified: z.boolean(),
    isSupporter: z.boolean(),
    twitchLogin: z.string().nullable(),
    tournamentWins: z.number().int(),
    tournamentFeaturedWins: z.number().int(),
    tournamentBestTitle: z.string().nullable(),
    onslaughtBestTier: z.string().nullable(),
    onslaughtBestRank: z.number().int().nullable(),
    onslaughtSeasons: z.number().int(),
    battles: z.number().int().meta({ description: "Their whole record in this vehicle." }),
    winrate: z.number().nullable(),
    avgDamage: z.number().nullable(),
    rating: ratings.meta({
      description: "WN7, WN8 and WNX over their whole record in this vehicle, which the ranking reads.",
    }),
    loadoutBattle: z
      .object({ arenaUniqueId: z.string(), startedAt: z.date() })
      .meta({ description: "The recorded battle the loadout was read from: their latest in this mode." }),
    equipment: z.array(z.string().nullable()).meta({
      description: "By slot, a free slot as null.",
    }),
    directives: z.array(z.string().nullable()),
    consumables: z.array(z.string().nullable()),
    fieldMods: z.array(z.string().nullable()).meta({
      description:
        "Every pair of the vehicle's tree, in tree order: the side taken, or null for a pair not taken.",
    }),
    crew: z.array(z.object({ role: z.string(), skills: z.array(z.string()) })),
    shells: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        premium: z.boolean(),
        count: z.number().int(),
      }),
    ),
  })
  .meta({
    id: "TankTopPlayer",
    description:
      "One of the best players in this vehicle among those whose battles are recorded, ranked on their career in it, with the loadout of their latest recorded battle in this mode. The top ten of each rating metric are included. Players who asked not to be shown are absent.",
  });

const topBattlePlayer = z
  .object({
    nickname: z.string(),
    accountId: z.number().int(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    isVerified: z.boolean(),
    isSupporter: z.boolean(),
    twitchLogin: z.string().nullable(),
    tournamentWins: z.number().int(),
    tournamentFeaturedWins: z.number().int(),
    tournamentBestTitle: z.string().nullable(),
    onslaughtBestTier: z.string().nullable(),
    onslaughtBestRank: z.number().int().nullable(),
    onslaughtSeasons: z.number().int(),
  })
  .meta({ id: "TankTopBattlePlayer" });

const topBattle = z
  .object({
    player: topBattlePlayer,
    battle: playerBattle.meta({
      description:
        "The battle, exactly as the player's own Battles tab answers it, loadout included.",
    }),
  })
  .meta({
    id: "TankTopBattle",
    description:
      "One player's best battle in this vehicle by damage dealt, with exactly what was fitted for it. One battle per player. Players who asked not to be shown are absent here while still counting towards every share above.",
  });

/** Response of `GET /{region}/tanks/{slug}/loadouts`. */
export const TankLoadoutsResponse = z.object({
  tankId: z.number().int(),
  mode: z.enum(LoadoutMode).meta({
    description: "The battle mode every figure below was counted in.",
    "x-enum-source": "LOADOUT_MODE",
  } as EnumMeta),
  modes: z
    .array(
      z.object({
        mode: z.enum(LoadoutMode).meta({
          description: "A battle mode the vehicle can be counted in.",
          "x-enum-source": "LOADOUT_MODE",
        } as EnumMeta),
        players: z.number().int(),
        battles: z.number().int(),
      }),
    )
    .meta({
      description:
        "Every mode's own sample for this vehicle, whichever mode was asked for, so a caller can pick a mode that holds something.",
    }),
  sample: z.number().int().meta({
    description:
      "Players in this mode. Every share in this payload is over this number, so a share should never be read without it.",
  }),
  battles: z.number().int().meta({
    description: "Their battles, which the performance figures are counted over.",
  }),
  items: z.array(itemUsage),
  crewSkills: z.array(crewSkillUsage),
  setups: z.array(popularSetup),
  ammo: z.object({
    battles: z.number().int(),
    premiumShare: z.number().nullable().meta({
      description:
        "Mean share of the rack bought with gold, 0 to 1, per battle rather than per round. Null while no counted battle carries a premium round, since the flag it is read from may simply not have been reported.",
    }),
    shellsLoaded: z.number().nullable(),
  }),
  topPlayers: z.array(topPlayer),
  topBattles: z.array(topBattle),
  updatedAt: z.date().nullable().meta({
    description: "Newest battle counted, so a reader can see how current this is.",
  }),
});
