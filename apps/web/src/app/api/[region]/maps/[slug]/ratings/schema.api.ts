// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod + shared enums): the community panel parses with it.
import { z } from "zod";
import {
  mapRatingAxisField,
  ratingConsensusField,
  regionPath,
  regionVerdict,
  starBar,
  voterBracketField,
} from "@/services/openapi/schemas";

/**
 * A map's community verdict, in the same shapes the vehicle one uses wherever
 * the two really mean the same thing.
 *
 * `starBar` and `regionVerdict` are the shared ones, imported rather than
 * restated: a five-star bar and one server's own average are the same fact
 * about any rated subject, and declaring them twice would publish two `$ref`s a
 * caller has to prove are identical.
 *
 * The three below are the map's own, and each is a place where the two
 * genuinely differ rather than a copy. Reusing the vehicle's `bracketVerdict`
 * in particular would have published a lie: its `avgBattles` documents battles
 * on the tank being rated, and no such figure exists for an arena.
 */

/**
 * What one slice of the population thinks.
 *
 * The split that earns the feature, and on a map it is often louder than on a
 * vehicle: an open field that punishes a mistake from eight hundred metres away
 * reads as miserable to someone still learning and as the best map in the game
 * to someone who can use it. Empty brackets are returned rather than omitted,
 * because "nobody good has rated this yet" is itself worth seeing.
 */
export const mapBracketVerdict = z.object({
  bracket: voterBracketField,
  votes: z.number().int(),
  overall: z.number().nullable(),
  fun: z.number().nullable(),
  avgBattles: z.number().nullable().meta({
    description:
      "Mean trailing-30-day battles these voters had played. Not battles on the map: Wargaming publishes no per-arena record, so what makes the slice credible is that its voters are active.",
  }),
});

/** One spoke of the radar, with what it rests on. */
export const mapAxisVerdict = z.object({
  axis: mapRatingAxisField,
  value: z.number().nullable(),
  votes: z.number().int(),
});

/**
 * A published written opinion about a map.
 *
 * Signed by the author's account record rather than by a record on the subject,
 * which is the honest difference from a vehicle review: nothing can prove this
 * author has been sent here. `recentBattles` is the column that carries the
 * weight instead, since a map is reworked between updates and a verdict from
 * somebody who has not played since 2019 is about a layout that no longer
 * exists.
 */
export const mapReview = z.object({
  id: z.number().int(),
  nickname: z.string(),
  region: regionPath,
  overall: z.number().int(),
  fun: z.number().int(),
  battles: z.number().int().nullable().meta({
    description: "Lifetime battles on the author's account.",
  }),
  recentBattles: z.number().int().nullable().meta({
    description:
      "Battles in the author's trailing 30 days: whether this is an opinion about the map as it is now.",
  }),
  winrate: z.number().nullable(),
  bracket: voterBracketField,
  playerWn8: z.number().nullable(),
  gameVersion: z.string().nullable().meta({
    description:
      "Client version the opinion was formed under, so a reader can see it predates a rework.",
  }),
  body: z.string(),
  createdAt: z.coerce.date(),
});

/** Response of `GET /{region}/maps/{slug}/ratings`. */
export const MapRatingsResponse = z.object({
  arenaId: z.string().meta({
    description:
      "The client's own arena id, which is what the votes are keyed on: a renamed map keeps it, a slug does not.",
  }),
  votes: z.number().int(),
  overall: z.number().nullable().meta({
    description: "Plain mean of the Overall stars, 1 to 5.",
  }),
  fun: z.number().nullable(),
  overallBayes: z.number().nullable().meta({
    description:
      "The Overall mean shrunk towards the average of every map vote, which is what the board ranks on so a map three people rated cannot top it. Null until the rollup cron has run.",
  }),
  funBayes: z.number().nullable(),
  overallStddev: z.number().nullable(),
  consensus: ratingConsensusField.nullable().meta({
    description:
      "How far apart the voters sit. Null under ten votes, where a spread is noise rather than a disagreement.",
  }),
  overallDistribution: z.array(starBar),
  funDistribution: z.array(starBar),
  brackets: z.array(mapBracketVerdict),
  regions: z.array(regionVerdict),
  axes: z.array(mapAxisVerdict),
  axisVotes: z.number().int().meta({
    description:
      "How many voters filled in the optional axes, always far fewer than the headline count.",
  }),
  avgVoterRecentBattles: z.number().nullable().meta({
    description:
      "Mean trailing-30-day battles across everyone who voted: whether this average was formed by people still playing.",
  }),
  reviews: z.array(mapReview),
  reviewCount: z.number().int().meta({
    description:
      "Published written opinions in total. Not the length of `reviews`, which is capped.",
  }),
});
