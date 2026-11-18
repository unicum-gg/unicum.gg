// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/**
 * A season's whole curve, one array per field rather than one object per
 * sample, every array the same length and in the same order.
 *
 * A season is captured every five minutes, which is several thousand samples,
 * and spelling the seven field names out on each of them was 63% of this
 * response. Nothing is left out: the chart draws the whole season and the
 * Legend projection is fitted over it. `t` is what says how long the curve is.
 */
export const onslaughtSeasonSeries = z
  .object({
    t: z.array(z.number()).meta({
      description:
        "Instant of each sample, unix seconds, chronological and oldest first. Its length is the length of the curve.",
    }),
    ranked: z.array(z.number()).meta({
      description: "Players holding a place on the board at each instant.",
    }),
    legendPoints: z.array(z.number().nullable()).meta({
      description: "Rating points needed for Legend, as published by the game.",
    }),
    championPoints: z.array(z.number().nullable()).meta({
      description:
        "Rating points sitting at the Champion position, read off the board.",
    }),
    topRating: z.array(z.number().nullable()),
    minRating: z.array(z.number().nullable()).meta({
      description: "The last ranked player's rating: the price of entry.",
    }),
    battles: z.array(z.number().nullable()).meta({
      description: "Battles summed over every ranked player.",
    }),
  })
  .meta({
    id: "OnslaughtSeasonSeries",
    description: "An Onslaught season's board over time, as parallel columns.",
  });

/** Response of `GET /{region}/players/onslaught/history`. */
export const OnslaughtHistoryResponse = z.object({
  eventId: z.string().meta({ description: "The season these samples belong to." }),
  series: onslaughtSeasonSeries,
});
