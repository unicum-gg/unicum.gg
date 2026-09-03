// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/** Where the player finished, or currently stands, in one season. */
export const playerOnslaughtStanding = z
  .object({
    eventId: z.string(),
    codename: z.string().nullable().meta({
      description: "Season codename ('Season of the Azure Phoenix').",
    }),
    seasonOrdinal: z.string().nullable().meta({
      description: "Season ordinal word, selecting its themed rank art.",
    }),
    assetsRef: z.string().nullable().meta({
      description:
        "Mirror commit to build rank-art URLs from (null = live branch); pins a past season's art to when it was live.",
    }),
    ended: z.boolean().meta({
      description: "True once the season is over (the placing is final).",
    }),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    rank: z.number().meta({ description: "Leaderboard position (1-based)." }),
    rating: z.number().meta({ description: "Season rating points." }),
    battles: z.number(),
    elitePosition: z.number().nullable().meta({
      description: "Top N ranks that are Legend, for reading the rank off.",
    }),
    masterPosition: z.number().nullable().meta({
      description: "Top N ranks that are at least Champion.",
    }),
  })
  .meta({
    id: "PlayerOnslaughtStanding",
    description: "A player's placing in one Onslaught season.",
  });

/** One instant of the player's own climb. */
export const playerOnslaughtPoint = z
  .object({
    t: z.number().meta({ description: "Instant of the sample, unix seconds." }),
    rank: z.number(),
    rating: z.number(),
    battles: z.number(),
  })
  .meta({
    id: "PlayerOnslaughtPoint",
    description: "A player's standing at one instant.",
  });

/** Response of `GET /{region}/players/{nickname}/onslaught`. */
export const PlayerOnslaughtResponse = z.object({
  account_id: z.number(),
  nickname: z.string(),
  standings: z.array(playerOnslaughtStanding).meta({
    description:
      "Every season this player ranked in, newest first. Empty when they have never reached Champion, which is the common case.",
  }),
  history: z.array(playerOnslaughtPoint).meta({
    description:
      "The player's climb through the most recent season they ranked in, oldest first.",
  }),
});
