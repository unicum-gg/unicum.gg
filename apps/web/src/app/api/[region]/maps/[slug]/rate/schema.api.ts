// Co-located request and response schemas (`.api.ts` so next-openapi-gen scans
// them). Client-safe: the rating form validates against them before sending.
import { z } from "zod";
import { MAX_REVIEW_LENGTH } from "@unicum.gg/shared";
import {
  ratingBlockField,
  reviewOutcomeField,
} from "@/services/openapi/schemas";

/** One step of the scale, the same five the vehicles use. Whole stars only: an
 * opinion given in halves is an opinion nobody agrees on the meaning of. */
const stars = z.number().int().min(1).max(5);

/**
 * Body of `POST /{region}/maps/{slug}/rate`.
 *
 * Two tiers, as the form has them. `overall` and `fun` are the vote, and they
 * are required together: an average is only worth reading if enough people cast
 * it, so the thing everyone is asked for costs two taps. The five axes below
 * are optional, individually, and feed the radar.
 *
 * None of them is a vehicle axis reworded. A map has no firepower, and asking
 * about its armour would get five answers about whatever tank the voter last
 * drove.
 */
export const MapRateBody = z.object({
  overall: stars.meta({ description: "How good the map is, all considered." }),
  fun: stars.meta({ description: "How much the voter enjoys being sent here." }),
  balance: stars.nullish().meta({
    description: "Do both sides start with an equal chance?",
  }),
  variety: stars.nullish().meta({
    description: "Is there more than one way to play it?",
  }),
  flow: stars.nullish().meta({
    description: "Does the battle move, or stall into a standoff?",
  }),
  classFairness: stars.nullish().meta({
    description: "Does every vehicle class have a job here?",
  }),
  beginnerFriendliness: stars.nullish().meta({
    description: "How forgiving is it if you are still learning?",
  }),
  // Only the upper bound here. The lower one is checked after the server has
  // normalised the text, because normalising collapses whitespace: a string of
  // 82 double-spaced characters passes a raw check and then falls under the
  // minimum, which would be a 400 on prose the form said was long enough.
  review: z
    .string()
    .max(MAX_REVIEW_LENGTH * 2)
    .nullish()
    .meta({
      description:
        "A written opinion, queued for moderation rather than published. Send null to withdraw one previously written; leaving the field out entirely keeps whatever is already there. Measured after whitespace is collapsed.",
    }),
});

/** Response of `POST /{region}/maps/{slug}/rate`. */
export const MapRateResponse = z.object({
  ok: z.boolean(),
  review: reviewOutcomeField.meta({
    description:
      "What became of the written opinion. Distinguishes text newly queued from text that was already published, still pending, previously rejected, or dropped because written opinions are closed. A boolean here would have claimed 'with a moderator' about prose that was rejected weeks ago.",
  }),
});

/** Response of `POST /{region}/maps/{slug}/rate` when the written opinion is
 * too short or too long once whitespace has been collapsed. */
export const MapRateReviewLengthResponse = z.object({
  error: z.literal("review_length"),
  min: z.number().int(),
  max: z.number().int(),
});

/** Response of `POST /{region}/maps/{slug}/rate` when the caller's account has
 * not played enough, so the form can say how far off they are rather than just
 * refusing. */
export const MapRateRefusedResponse = z.object({
  error: z.literal("not_eligible"),
  block: ratingBlockField.nullable(),
  required: z.number().int(),
  battles: z.number().int().nullable(),
});
