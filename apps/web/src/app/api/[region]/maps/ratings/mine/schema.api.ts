// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankReviewStatusField } from "@/services/openapi/schemas";

/** One map the caller has already given a verdict on. */
export const ownMapRatingRow = z.object({
  arenaId: z.string().meta({
    description:
      "The client's own arena id, which is what the vote is keyed on. Resolve it against `GET /{region}/maps` for a slug and a name.",
  }),
  overall: z.number().int(),
  fun: z.number().int(),
  reviewStatus: tankReviewStatusField,
  updatedAt: z.coerce.date(),
});

/** Response of `GET /{region}/maps/ratings/mine`. */
export const OwnMapRatingsResponse = z.object({
  ratings: z.array(ownMapRatingRow),
});
