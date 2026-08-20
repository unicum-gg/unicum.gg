// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  ratingBlockField,
  regionPath,
  tankRatingAxisField,
  tankReviewStatusField,
  voterBracketField,
} from "@/services/openapi/schemas";

/** One answered axis, as a pair rather than a map: an object keyed by enum
 * values renders as a free-form dictionary in the spec, which says nothing
 * about which keys are legal. */
export const axisAnswer = z.object({
  axis: tankRatingAxisField,
  value: z.number().int(),
});

/** What the caller has done on the tank, which is what the gate is decided on
 * and what their vote will be signed with. */
export const voterRecord = z.object({
  battles: z.number().int(),
  winrate: z.number().nullable(),
  avgDamage: z.number().nullable(),
  tankWn8: z.number().nullable().meta({
    description: "Their WN8 on this tank, not on their account.",
  }),
  marksOnGun: z.number().int().nullable(),
  markOfMastery: z.number().int().nullable(),
});

/** The caller themselves, which is the axis the community split is read on. */
export const voterProfile = z.object({
  wn8: z.number().nullable(),
  battles: z.number().int().nullable(),
  bracket: voterBracketField,
});

/** The caller's own vote, including text nobody else may see: the author is
 * exactly who needs to know their review has not gone up yet. */
export const ownRating = z.object({
  overall: z.number().int(),
  fun: z.number().int(),
  axes: z.array(axisAnswer),
  review: z.string().nullable(),
  reviewStatus: tankReviewStatusField,
  battles: z.number().int().meta({
    description: "Their battles on the tank when the vote was last saved.",
  }),
  gameVersion: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

/** Response of `GET /{region}/tanks/{slug}/ratings/me`. */
export const TankRatingMeResponse = z.object({
  signedIn: z.boolean(),
  votingRegion: regionPath.nullable().meta({
    description:
      "The server the caller votes on, read from their own account rather than from the path. Null when signed out.",
  }),
  eligible: z.boolean(),
  block: ratingBlockField.nullable(),
  required: z.number().int().meta({
    description: "Battles on the tank an account needs before it may rate it.",
  }),
  record: voterRecord.nullable(),
  player: voterProfile.nullable(),
  rating: ownRating.nullable(),
  reviewsOpen: z.boolean().meta({
    description:
      "Whether written opinions are being accepted. False closes the text field and leaves the stars working, since they need no moderation.",
  }),
});
