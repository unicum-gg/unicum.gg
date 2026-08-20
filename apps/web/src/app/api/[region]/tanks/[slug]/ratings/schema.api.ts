// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the community tab parses with it.
import { z } from "zod";
import {
  ratingConsensusField,
  regionPath,
  tankRatingAxisField,
  voterBracketField,
} from "@/services/openapi/schemas";

/** One bar of a five-star histogram. The share travels with the count so the
 * bar needs no division at render, and so a client cannot draw a different
 * distribution from the same numbers. */
export const starBar = z.object({
  stars: z.number().int().meta({ description: "1 to 5." }),
  votes: z.number().int(),
  share: z.number().meta({ description: "Share of this tank's votes, 0 to 1." }),
});

/**
 * What one slice of the population thinks.
 *
 * The whole point of the feature: a tank that unicums rate 4.6 and everyone
 * else rates 3.1 rewards knowing what you are doing, and no single average can
 * say that. Empty brackets are returned rather than omitted, because "nobody
 * good has rated this yet" is itself worth seeing.
 */
export const bracketVerdict = z.object({
  bracket: voterBracketField,
  votes: z.number().int(),
  overall: z.number().nullable(),
  fun: z.number().nullable(),
  avgBattles: z.number().nullable().meta({
    description:
      "Mean battles these voters have on the tank, which is what makes the slice credible or not.",
  }),
});

/** The same split by server, for the metas that differ rather than the players
 * who do. */
export const regionVerdict = z.object({
  region: regionPath,
  votes: z.number().int(),
  overall: z.number().nullable(),
  fun: z.number().nullable(),
});

/** One spoke of the radar, with what it rests on. */
export const axisVerdict = z.object({
  axis: tankRatingAxisField,
  value: z.number().nullable(),
  votes: z.number().int(),
});

/**
 * A published written opinion.
 *
 * Signed by a record rather than by a name alone: what makes a review worth
 * reading is that the author has the battles, so the columns proving it travel
 * with the text and are shown next to it.
 */
export const tankReview = z.object({
  id: z.number().int(),
  nickname: z.string(),
  region: regionPath,
  overall: z.number().int(),
  fun: z.number().int(),
  battles: z.number().int().meta({
    description: "The author's battles on this tank when they wrote it.",
  }),
  winrate: z.number().nullable(),
  avgDamage: z.number().nullable(),
  marksOnGun: z.number().int().nullable(),
  bracket: voterBracketField,
  playerWn8: z.number().nullable(),
  gameVersion: z.string().nullable().meta({
    description:
      "Client version the opinion was formed under, so a reader can see it predates a rebalance.",
  }),
  body: z.string(),
  createdAt: z.coerce.date(),
});

/** Response of `GET /{region}/tanks/{slug}/ratings`. */
export const TankRatingsResponse = z.object({
  tankId: z.number().int(),
  votes: z.number().int(),
  overall: z.number().nullable().meta({
    description: "Plain mean of the Overall stars, 1 to 5.",
  }),
  fun: z.number().nullable(),
  overallBayes: z.number().nullable().meta({
    description:
      "The Overall mean shrunk towards the site-wide average, which is what the boards rank on so a four-vote tank cannot top them. Null until the rollup cron has run.",
  }),
  funBayes: z.number().nullable(),
  overallStddev: z.number().nullable(),
  consensus: ratingConsensusField.nullable().meta({
    description:
      "How far apart the voters sit. Null under ten votes, where a spread is noise rather than a disagreement.",
  }),
  overallDistribution: z.array(starBar),
  funDistribution: z.array(starBar),
  brackets: z.array(bracketVerdict),
  regions: z.array(regionVerdict),
  axes: z.array(axisVerdict),
  axisVotes: z.number().int().meta({
    description:
      "How many voters filled in the optional axes, always far fewer than the headline count.",
  }),
  avgVoterBattles: z.number().nullable().meta({
    description:
      "Mean battles on the tank across everyone who voted: whether this average was formed by people who play it.",
  }),
  perceivedPercentile: z.number().nullable().meta({
    description:
      "Where the community's verdict sits among the rated vehicles of the same tier, 0 to 1.",
  }),
  measuredPercentile: z.number().nullable().meta({
    description:
      "Where the tank's measured win rate sits among that same set, 0 to 1. Both halves are ranked over the rated vehicles of the tier so their difference is in one unit.",
  }),
  hype: z.number().nullable().meta({
    description:
      "Perceived minus measured. Positive means the community rates it above what it actually does.",
  }),
  reviews: z.array(tankReview),
  reviewCount: z.number().int().meta({
    description:
      "Published written opinions in total. Not the length of `reviews`, which is capped.",
  }),
});
