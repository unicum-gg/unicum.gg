// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankReviewStatusField } from "@/services/openapi/schemas";

/** One vehicle the caller has already given a verdict on. */
export const ownRatingRow = z.object({
  tankId: z.number().int(),
  overall: z.number().int(),
  fun: z.number().int(),
  battles: z.number().int().meta({
    description: "Their battles on the tank when the vote was last saved.",
  }),
  reviewStatus: tankReviewStatusField,
  updatedAt: z.coerce.date(),
});

/** Response of `GET /{region}/ratings/mine`. */
export const OwnRatingsResponse = z.object({
  ratings: z.array(ownRatingRow),
});
