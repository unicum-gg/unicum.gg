// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums).
import { z } from "zod";
import { LoadoutMode, MapFinishReason } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { answerLanguageField } from "@/services/openapi/locale";
import { playerBattle } from "@/app/api/[region]/players/[nickname]/battles/schema.api";

export const mapStatisticsQuery = z.object({
  // Written out in full, `.optional()` and never `.default()`, for the reasons
  // the vehicle loadouts query gives: the generator reads these off the AST.
  mode: z
    .enum(LoadoutMode)
    .optional()
    .meta({
      description:
        "Which battle mode to count, random by default. Modes are never pooled: each has its own team size, length and idea of a good result, so every figure in the response belongs to the one asked for. The modes field says which ones hold battles on this map.",
      "x-enum-source": "LOADOUT_MODE",
    } as EnumMeta),
  // Names the fitted items of the best battles, which are drawn with their
  // names on hover.
  language: answerLanguageField.optional(),
});

const mapStatsRatings = z.object({
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
});

const mapStatsAverages = {
  winrate: z.number().nullable().meta({
    description: "Records on the winning side over records, 0 to 1. A draw is not a win.",
  }),
  avgDamage: z.number().nullable().meta({ description: "Damage dealt per record." }),
  avgAssist: z.number().nullable().meta({
    description: "Damage dealt by others on this vehicle's spotting or tracking, per record.",
  }),
  avgKills: z.number().nullable(),
  avgSpotted: z.number().nullable(),
  survival: z.number().nullable().meta({
    description: "Records still alive when the battle ended, over records, 0 to 1.",
  }),
  avgXp: z.number().nullable().meta({ description: "Experience earned per record, before any bonus." }),
};

const mapRecordStats = z
  .object({
    players: z.number().int().meta({ description: "Different accounts among the records." }),
    records: z.number().int().meta({
      description: "Vehicle records: one account's part in one battle.",
    }),
    ...mapStatsAverages,
  })
  .meta({
    id: "MapRecordStats",
    description: "How the vehicle records behind a row went. Bots are not counted.",
  });

const mapRecordBaseline = z.object(mapStatsAverages).meta({
  id: "MapRecordBaseline",
  description:
    "The same vehicles over every map of the mode, each weighted by its records on this map, so the difference with the row says something about the map rather than about which vehicles were sent to it.",
});

const mapGroupStats = z
  .object({
    key: z.string().meta({
      description: "The vehicle class (heavyTank, AT-SPG...) or the tier, as a string.",
    }),
    stats: mapRecordStats,
    baseline: mapRecordBaseline,
  })
  .meta({ id: "MapGroupStats" });

const mapTankStats = z
  .object({
    tankId: z.number().int(),
    vehicle: z
      .object({
        slug: z.string().nullable(),
        name: z.string(),
        shortName: z.string(),
        tag: z.string(),
        type: z.string(),
        tier: z.number().int(),
        nation: z.string(),
        role: z.string().nullable(),
        isPremium: z.boolean(),
        isReward: z.boolean(),
      })
      .nullable()
      .meta({ description: "Null for a vehicle the catalogue does not know yet." }),
    stats: mapRecordStats,
    rating: mapStatsRatings.meta({
      description: "WN7, WN8 and WNX over its records on this map, with the site's own formulas.",
    }),
    baselineRating: mapStatsRatings.meta({
      description: "The same vehicle's ratings over every map of the mode.",
    }),
  })
  .meta({ id: "MapTankStats" });

const mapTopBattlePlayer = z
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
  .meta({ id: "MapTopBattlePlayer" });

const mapTopBattle = z
  .object({
    player: mapTopBattlePlayer,
    battle: playerBattle.meta({
      description:
        "The battle, exactly as the player's own Battles tab answers it, loadout included.",
    }),
  })
  .meta({
    id: "MapTopBattle",
    description:
      "One player's best battle on this map by damage dealt. One battle per player. Players who asked not to be shown are absent here while still counting towards every figure above.",
  });

/** Response of `GET /{region}/maps/{slug}/statistics`. */
export const MapStatisticsResponse = z.object({
  arenaId: z.string(),
  mode: z.enum(LoadoutMode).meta({
    description: "The battle mode every figure below was counted in.",
    "x-enum-source": "LOADOUT_MODE",
  } as EnumMeta),
  modes: z
    .array(
      z.object({
        mode: z.enum(LoadoutMode).meta({
          description: "A battle mode the map can be counted in.",
          "x-enum-source": "LOADOUT_MODE",
        } as EnumMeta),
        battles: z.number().int(),
      }),
    )
    .meta({
      description:
        "Every mode's own battles on this map, whichever mode was asked for, so a caller can pick one that holds something.",
    }),
  battles: z.number().int().meta({
    description:
      "Battles counted. The unit of the duration, the endings and the spawn balance.",
  }),
  players: z.number().int(),
  records: z.number().int().meta({
    description:
      "Vehicle records across those battles, which every class, tier and vehicle row is counted over.",
  }),
  avgDuration: z.number().nullable().meta({ description: "Seconds." }),
  finish: z.array(
    z.object({
      reason: z.enum(MapFinishReason).meta({
        description:
          "How the battle ended: a team destroyed, a base captured, the clock run out, or anything else.",
        "x-enum-source": "MAP_FINISH_REASON",
      } as EnumMeta),
      battles: z.number().int(),
    }),
  ),
  spawns: z
    .object({
      team1: z.number().int(),
      team2: z.number().int(),
      draws: z.number().int(),
    })
    .meta({
      description:
        "Battles each team won, the game's team 1 being the one that starts at base 1. Assignment is random, so a large and lasting gap is about the map.",
    }),
  classes: z.array(mapGroupStats),
  tiers: z.array(mapGroupStats),
  tanks: z.array(mapTankStats),
  topBattles: z.array(mapTopBattle),
  updatedAt: z.date().nullable().meta({
    description: "Newest battle counted, so a reader can see how current this is.",
  }),
});
