// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { RatingColor, RatingScale, RatingScaleUnit } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

const ratingScaleBand = z
  .object({
    color: z.enum(RatingColor).meta({
      description: "The band's name on the site's nine-step scale.",
      "x-enum-source": "RATING_COLOR",
    } as EnumMeta),
    hex: z.string().meta({ description: "The colour the site paints it with." }),
    from: z
      .number()
      .nullable()
      .meta({ description: "Lower edge, included. Null on the first band, which really is unbounded." }),
    to: z
      .number()
      .nullable()
      .meta({ description: "Upper edge, excluded. Null on the last band." }),
  })
  .meta({
    id: "RatingScaleBand",
    description: "One half-open band of a scale: `from` included, `to` excluded.",
  });

const ratingScaleInfo = z
  .object({
    scale: z.enum(RatingScale).meta({
      description: "Which quantity this scale paints.",
      "x-enum-source": "RATING_SCALE",
    } as EnumMeta),
    unit: z.enum(RatingScaleUnit).meta({
      description:
        "How its numbers are written: `ratio` runs 0 to 1, `points` and `stars` are the value as shown. A caller holding a win rate as a percentage has to divide before comparing it to a `ratio` scale.",
      "x-enum-source": "RATING_SCALE_UNIT",
    } as EnumMeta),
    bands: z.array(ratingScaleBand),
  })
  .meta({
    id: "RatingScaleInfo",
    description: "One scale, its unit, and its bands in ascending order.",
  });

/**
 * Response of `GET /ratings/scales`.
 *
 * Every scale in one answer rather than one endpoint per metric: a client that
 * paints anything wants the lot, once, at startup, and the set is small enough
 * that splitting it would only cost round trips.
 */
export const RatingScalesResponse = z.object({
  scales: z.array(ratingScaleInfo),
});
