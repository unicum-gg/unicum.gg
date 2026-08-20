// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankIdentity } from "../identity.api";

/** One vehicle on the community board: who it is, and what the server thinks of
 * it. Vehicles nobody has rated are absent rather than present with nulls, so a
 * caller can tell "unrated" from "rated badly". */
export const tankRatingRow = z
  .object({
    identity: tankIdentity,
    votes: z.number().int(),
    reviews: z.number().int().meta({
      description: "Published written opinions on this vehicle.",
    }),
    overall: z.number().nullable().meta({
      description: "Plain mean of the Overall stars, 1 to 5.",
    }),
    fun: z.number().nullable(),
    overallBayes: z.number().nullable().meta({
      description:
        "The Overall mean shrunk towards the site-wide average. Sort on this, not on the plain mean, or the top of the board is whichever tank three people rated.",
    }),
    funBayes: z.number().nullable(),
    overallStddev: z.number().nullable().meta({
      description: "How far apart the voters sit. High marks a divisive tank.",
    }),
    perceivedPercentile: z.number().nullable().meta({
      description:
        "Where the community ranks it among the rated vehicles of its own tier, 0 to 1.",
    }),
    measuredPercentile: z.number().nullable().meta({
      description:
        "Where its measured win rate ranks it among that same set, 0 to 1. Null until the tier has enough rated vehicles for a rank to mean anything.",
    }),
    hype: z.number().nullable().meta({
      description:
        "Perceived minus measured. Positive means the community rates it above what it does, negative below.",
    }),
  })
  .meta({
    id: "TankRatingRow",
    description:
      "A vehicle's community verdict, next to how it actually performs.",
  });

/** Response of `GET /{region}/tanks/ratings`. */
export const TankRatingBoardResponse = z.object({
  results: z.array(tankRatingRow),
  totalVotes: z.number().int().meta({
    description: "Votes cast across every vehicle, for the board's header.",
  }),
  ratedTanks: z.number().int(),
  computedAt: z.coerce.date().nullable().meta({
    description:
      "When the rollup behind the shrunk means and the hype column was last recomputed.",
  }),
});
