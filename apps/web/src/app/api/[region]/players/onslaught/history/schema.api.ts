// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/** The board as a whole at one instant. */
export const onslaughtSeasonPoint = z
  .object({
    t: z.number().meta({
      description: "Instant of the sample, unix seconds.",
    }),
    ranked: z.number().meta({
      description: "Players holding a place on the board at this instant.",
    }),
    legendPoints: z.number().nullable().meta({
      description: "Rating points needed for Legend, as published by the game.",
    }),
    championPoints: z.number().nullable().meta({
      description:
        "Rating points sitting at the Champion position, read off the board.",
    }),
    topRating: z.number().nullable(),
    minRating: z.number().nullable().meta({
      description: "The last ranked player's rating: the price of entry.",
    }),
    battles: z.number().nullable().meta({
      description: "Battles summed over every ranked player.",
    }),
  })
  .meta({
    id: "OnslaughtSeasonPoint",
    description: "One sample of an Onslaught season's board.",
  });

/** Response of `GET /{region}/players/onslaught/history`. */
export const OnslaughtHistoryResponse = z.object({
  eventId: z.string().meta({ description: "The season these samples belong to." }),
  points: z.array(onslaughtSeasonPoint).meta({
    description: "Samples in chronological order, oldest first.",
  }),
});
