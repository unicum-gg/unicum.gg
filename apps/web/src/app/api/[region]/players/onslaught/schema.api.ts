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
    available: z.boolean().meta({
      description: "True when we hold standings for this season (selectable).",
    }),
    eventId: z.string().nullable().meta({
      description: "Season id to navigate to (available seasons only).",
    }),
  })
  .meta({ id: "OnslaughtSeasonRef", description: "A season selector entry." });

/** Response of `GET /{region}/players/onslaught` (the Onslaught board). */
export const OnslaughtResponse = z.object({
  season: onslaughtSeason.nullable(),
  seasons: z.array(onslaughtSeasonRef),
  results: z.array(onslaughtSummary),
});
