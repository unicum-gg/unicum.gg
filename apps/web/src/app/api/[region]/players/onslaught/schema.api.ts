// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/** One row of the Onslaught (Competitive 7) leaderboard, in Wargaming's own
 * authoritative rank order. */
export const onslaughtSummary = z
  .object({
    rank: z.number().meta({
      description: "Leaderboard position (1-based), from the game source.",
    }),
    account_id: z.number(),
    nickname: z.string().meta({
      description: "Current nickname, resolved by account_id.",
    }),
    clan_tag: z.string().nullable(),
    clan_color: z.string().nullable(),
    recordedNickname: z.string().meta({
      description: "Nickname as recorded on the leaderboard when ranked.",
    }),
    recordedClanTag: z.string().nullable(),
    recordedClanColor: z.string().nullable(),
    rating: z.number().meta({
      description: "Season score / rating points (the ranking metric).",
    }),
    battles: z.number().meta({
      description: "Battles played in the mode over the season.",
    }),
    activeDays: z.number().optional().meta({
      description:
        "Days this account was seen playing, from our own capture archive. Absent for a season we hold no captures of.",
    }),
    battlesPerDay: z.number().optional().meta({
      description:
        "Battles per day PLAYED (not per day of the season): observed battles divided by activeDays.",
    }),
    pointsPerDay: z.number().optional().meta({
      description:
        "Rating points won or lost per day played. Negative for a player who is losing ground.",
    }),
    pointsPerBattle: z.number().optional().meta({
      description:
        "Rating points per observed battle. Excludes the account's entry state, which belongs to no day.",
    }),
    lastActiveAt: z.number().optional().meta({
      description:
        "Unix seconds of the last capture where this account's battle count moved.",
    }),
    entryBattles: z.number().optional().meta({
      description:
        "Battles played in the mode by the time the account first appeared on the board: what qualifying cost. Absent for a season we hold no captures of, and for the few already ranked when the capture began.",
    }),
    wn7: z.number().nullable().meta({
      description: "The account's overall WN7, for the board's tier summary.",
    }),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    pr: z.number().nullable().optional().meta({
      description: "The account's Personal Rating, Wargaming's own figure.",
    }),
    wtr: z.number().nullable().optional().meta({
      description: "The account's World of Tanks Rating, Wargaming's own figure.",
    }),
    is_verified: z.boolean().optional(),
    tournament_wins: z.number().optional().meta({
      description:
        "Tournaments this account was on the winning roster of, for the winner's crest.",
    }),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
    onslaught_best_tier: z.string().nullable().optional(),
    onslaught_best_rank: z.number().nullable().optional(),
    onslaught_seasons: z.number().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
  })
  .meta({
    id: "OnslaughtSummary",
    description: "Onslaught leaderboard row (ranked by score).",
  });

/** A player who held a place this season and lost it. The feeder prunes anyone
 * who has left the board from the standings, so they are recovered from the
 * daily fold instead. */
export const onslaughtDropout = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    clan_tag: z.string().nullable(),
    clan_color: z.string().nullable(),
    bestRank: z.number().meta({
      description: "The best position they reached before losing the place.",
    }),
    lastRank: z.number().meta({
      description: "Where they stood the last time we saw them on the board.",
    }),
    lastRating: z.number(),
    battles: z.number().meta({
      description: "Battles played in the mode when they were last seen.",
    }),
    lastSeenAt: z.number().meta({
      description:
        "Unix seconds of the last capture that still had them on the board.",
    }),
    is_verified: z.boolean().optional(),
    tournament_wins: z.number().optional(),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
    onslaught_best_tier: z.string().nullable().optional(),
    onslaught_best_rank: z.number().nullable().optional(),
    onslaught_seasons: z.number().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
  })
  .meta({
    id: "OnslaughtDropout",
    description: "A player who lost their place on the board this season.",
  });

/** The current Onslaught season: window plus the rank thresholds the board
 * colors by (Elite / Master). */
export const onslaughtSeason = z
  .object({
    eventId: z.string(),
    name: z.string(),
    codename: z.string().nullable().meta({
      description:
        "Season codename ('Season of the Jade Dragon'), from the client; null if unavailable.",
    }),
    seasonOrdinal: z.string().nullable().meta({
      description:
        "Season ordinal word ('third' for Jade), selecting its themed rank art.",
    }),
    assetsRef: z.string().nullable().meta({
      description:
        "Mirror commit to build rank-art URLs from (null = live branch); pins a past season's art to when it was live.",
    }),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    ended: z.boolean().meta({
      description: "True once the season has ended (standings are final).",
    }),
    elitePosition: z.number().nullable().meta({
      description: "Top N ranks that are Elite tier.",
    }),
    masterPosition: z.number().nullable().meta({
      description:
        "Top N ranks that are at least Master (as far as the board reaches).",
    }),
    lastRecalculationTs: z.number().nullable().meta({
      description: "Unix seconds of the source's last leaderboard recompute.",
    }),
  })
  .meta({
    id: "OnslaughtSeason",
    description: "Onslaught season metadata.",
  });

/** One entry of the season selector. Mirrors the game's full season history so
 * the list is complete; `available` marks the seasons we hold data for (the rest
 * render disabled). */
export const onslaughtSeasonRef = z
  .object({
    key: z.string().meta({ description: "Stable list key." }),
    label: z.string().meta({
      description:
        "Display label ('Season of the Jade Dragon' or 'Year of the Griffin').",
    }),
    ordinal: z.string().nullable().meta({
      description:
        "Season ordinal word ('third'), which is how the client keys its own season names. Null for a year archive.",
    }),
    available: z.boolean().meta({
      description: "True when we hold standings for this season (selectable).",
    }),
    eventId: z.string().nullable().meta({
      description: "Season id to navigate to (available seasons only).",
    }),
  })
  .meta({ id: "OnslaughtSeasonRef", description: "A season selector entry." });

/** How the season before this one ended: the only end state the page holds,
 * since everything about the running season is still moving. */
export const onslaughtPreviousSeason = z
  .object({
    eventId: z.string(),
    codename: z.string().nullable().meta({
      description: "That season's codename, for the reader's own language.",
    }),
    seasonOrdinal: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    ranked: z.number().meta({
      description:
        "Players holding a place when it settled, which is what the running season's count is heading towards.",
    }),
    legendPoints: z.number().nullable().meta({
      description: "What Legend cost at the end: the rating at the last Legend position.",
    }),
    championPoints: z.number().nullable().meta({
      description: "The board's floor at the end, which is Champion's threshold.",
    }),
    legendBattles: z.number().nullable().meta({
      description:
        "Median battles its Legends had played over the WHOLE season. Comparable to a finished season, not to a running one, since the field nearly triples before it settles.",
    }),
    championBattles: z.number().nullable().meta({
      description: "The same for the players who ended Champion.",
    }),
  })
  .meta({
    id: "OnslaughtPreviousSeason",
    description: "How the previous Onslaught season ended.",
  });

/** The median rating a cohort carries in ordinary battles, per metric. All five
 * rather than the one the reader picked, since that pick lives in a cookie only
 * their browser can read. */
export const onslaughtCohortRatings = z
  .object({
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    pr: z.number().nullable(),
    wtr: z.number().nullable(),
  })
  .meta({
    id: "OnslaughtCohortRatings",
    description: "Median overall rating of a cohort, per metric.",
  });

/** Who the players holding one rank are: the figures the standings cannot show,
 * since a row says where someone placed and nothing about what it took. */
export const onslaughtTierProfile = z
  .object({
    tier: z.enum(["legend", "champion"]).meta({
      description: "The rank this cohort holds.",
    }),
    players: z.number(),
    ratings: onslaughtCohortRatings,
    entryBattles: z.number().nullable().meta({
      description:
        "Median battles they had played when they first appeared on the board: the price of qualifying.",
    }),
    seasonBattles: z.number().nullable().meta({
      description:
        "Median battles played over the whole season: the price of staying, which is the larger of the two.",
    }),
    daysPlayed: z.number().nullable().meta({
      description: "Median days they were actually seen playing.",
    }),
  })
  .meta({
    id: "OnslaughtTierProfile",
    description: "Who the players of one Onslaught rank are.",
  });

/**
 * What the board says about itself as a whole, computed over every ranked row.
 *
 * Here rather than left to the caller because `results` is a PAGE of the
 * standings: three of the page's panels describe the board instead of a row of
 * it, and shipping thousands of rows so a browser could average them is what
 * made this the heaviest page on the site.
 */
export const onslaughtAggregatesSchema = z
  .object({
    ranked: z.number().meta({
      description: "Players holding a place, which is the board's own length.",
    }),
    legendPoints: z.number().nullable().meta({
      description: "The rating at the last Legend position: what Legend costs.",
    }),
    championPoints: z.number().nullable().meta({
      description:
        "The board's floor, which is Champion's threshold, since the board reaches exactly that far.",
    }),
    reference: z.number().meta({
      description:
        "Unix seconds of the newest capture on the board, which is the clock every activity figure is read against. Zero for a season we hold no captures of.",
    }),
    activity: z
      .object({
        today: z.number(),
        week: z.number(),
        idle: z.number(),
      })
      .meta({
        id: "OnslaughtActivityCounts",
        description: "Ranked players per activity bucket.",
      }),
    tiers: z
      .object({
        legend: z.number(),
        champion: z.number(),
      })
      .meta({
        id: "OnslaughtTierCounts",
        description: "Ranked players per rank.",
      }),
    profiles: z.array(onslaughtTierProfile),
    entryBar: z.number().meta({
      description:
        "The rating a player enters the board at, which is Champion's threshold.",
    }),
    entryBattles: z.number().meta({
      description:
        "Median battles the board's own players had played when they first appeared on it.",
    }),
    battleQuantiles: z.array(z.number()).meta({
      description:
        "Quartiles of the season battles of everyone ranked, raw. Divided by the days the season has run to read as a pace, which is why they are published undivided: that divisor comes from the season curve, which is fetched apart from this board.",
    }),
    ratings: z.array(z.number()).meta({
      description:
        "Every ranked rating, descending, so a reader's own standing is counted rather than interpolated.",
    }),
    rateRatings: z.array(z.number()).meta({
      description:
        "The rating of every ranked row whose points per battle we measured, parallel to ratePerBattle. It is what lets a reader's own figure be read against the neighbourhood they are in rather than against the whole board, where the rate rises with the standings.",
    }),
    ratePerBattle: z.array(z.number()).meta({
      description:
        "The measured points per battle of those same rows, in the same order, to three decimals.",
    }),
  })
  .meta({
    id: "OnslaughtAggregates",
    description: "What the Onslaught board says about itself as a whole.",
  });

/** Response of `GET /{region}/players/onslaught` (the Onslaught board). */
export const OnslaughtResponse = z.object({
  season: onslaughtSeason.nullable(),
  seasons: z.array(onslaughtSeasonRef),
  results: z.array(onslaughtSummary).meta({
    description:
      "One page of the standings, in rank order: `limit` rows from `offset`. The default is the whole board.",
  }),
  aggregates: onslaughtAggregatesSchema,
  previous: onslaughtPreviousSeason.nullable().meta({
    description:
      "How the season before the one being served ended. Null when it is the first season we hold standings for.",
  }),
  dropouts: z.array(onslaughtDropout).meta({
    description:
      "Players who held a place this season and lost it, newest first, one page of them on the same `limit` and `offset` as the standings. Recovered from our own daily fold, since the standings only carry who is ranked now. Empty for a season we hold no captures of.",
  }),
  lost: z.number().meta({
    description:
      "How many lost their place in all, since `dropouts` is a page of them and the board names the count on its own tab.",
  }),
});
