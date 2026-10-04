// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  mapRatingAxisField,
  ratingBlockField,
  regionPath,
  tankReviewStatusField,
  voterBracketField,
} from "@/services/openapi/schemas";

/** One answered axis, as a pair rather than a map: an object keyed by enum
 * values renders as a free-form dictionary in the spec, which says nothing
 * about which keys are legal. */
export const mapAxisAnswer = z.object({
  axis: mapRatingAxisField,
  value: z.number().int(),
});

/**
 * The caller themselves, which is the whole of the evidence a map vote is
 * signed with.
 *
 * One object where the vehicle endpoint answers with two (a record on the tank,
 * a profile of the player), because here they collapse: there is nothing about
 * the arena to record, for us or for anybody.
 */
export const mapVoterProfile = z.object({
  wn8: z.number().nullable(),
  battles: z.number().int().nullable().meta({
    description: "Lifetime battles, which is what the gate is decided on.",
  }),
  recentBattles: z.number().int().nullable().meta({
    description:
      "Battles in the trailing 30 days, which is what a published review is dated by.",
  }),
  winrate: z.number().nullable(),
  bracket: voterBracketField,
});

/** The caller's own vote, including text nobody else may see: the author is
 * exactly who needs to know their review has not gone up yet. */
export const ownMapRating = z.object({
  overall: z.number().int(),
  fun: z.number().int(),
  axes: z.array(mapAxisAnswer),
  review: z.string().nullable(),
  reviewStatus: tankReviewStatusField,
  gameVersion: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

/** Response of `GET /{region}/maps/{slug}/ratings/me`. */
export const MapRatingMeResponse = z.object({
  signedIn: z.boolean(),
  votingRegion: regionPath.nullable().meta({
    description:
      "The server the caller votes on, read from their own account rather than from the path. Null when signed out.",
  }),
  eligible: z.boolean(),
  block: ratingBlockField.nullable().meta({
    description:
      "Why the caller may not rate a map yet. Only `no_record` and `too_few_battles` are reachable here: `never_played` would need a per-arena record nobody publishes.",
  }),
  required: z.number().int().meta({
    description:
      "Battles on the account before it may rate a map. A weaker claim than the vehicle gate's and deliberately so, since the rotation decides where a player is sent rather than the player.",
  }),
  player: mapVoterProfile.nullable(),
  rating: ownMapRating.nullable(),
  reviewsOpen: z.boolean().meta({
    description:
      "Whether written opinions are being accepted. False closes the text field and leaves the stars working, since they need no moderation. One answer for the whole site: there is one queue and one moderator.",
  }),
});
