// Response schema for the similar-tanks endpoint. `.api.ts` so
// next-openapi-gen scans it; server-free (zod + shared only) so the page can
// parse the response with it too.
import { z } from "zod";
import { SIMILAR_RESULTS_MAX, TankAxis } from "@unicum.gg/shared";
import { tankIdentity } from "../../identity.api";
import type { EnumMeta } from "@/services/openapi/schemas";

/** How many matches the section shows. A plain const rather than `limitField`:
 * the generator resolves a `.default()` only from a literal or a same-file
 * const, so a shared helper taking the default as an argument would document
 * the wrong one. The ceiling is not restated here, it is the number core
 * actually keeps, so the doc cannot advertise more than the endpoint serves. */
export const SIMILAR_DEFAULT_LIMIT = 6;

export const similarTanksQuery = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(SIMILAR_RESULTS_MAX)
    .default(SIMILAR_DEFAULT_LIMIT)
    .optional()
    .meta({
      description:
        "How many matches to return. Out-of-range values are clamped.",
    }),
});

const tankAxisField = z.enum(TankAxis).meta({
  description:
    "An aspect a vehicle is read along. Five come from its characteristics; playstyle comes from how the server actually plays it.",
  "x-enum-source": "TANK_AXIS",
} as EnumMeta);

export const similarTank = z
  .object({
    identity: tankIdentity,
    score: z.number().meta({
      description:
        "How alike the two vehicles are, 0 to 100, as the distance between where each one stands among the vehicles of its own tier.",
    }),
    closest: z.array(tankAxisField).meta({
      description: "The axes the two are closest on, nearest first.",
    }),
    furthest: tankAxisField.nullable().meta({
      description: "The axis they are furthest apart on.",
    }),
  })
  .meta({
    id: "SimilarTank",
    description:
      "A vehicle that plays like the one being read, with how alike they are and on which aspects.",
  });

export const similarTanks = z
  .object({ results: z.array(similarTank) })
  .meta({
    id: "SimilarTanks",
    description:
      "The vehicles that play most like this one, best match first. Empty when the vehicle is too little known to be placed.",
  });

export type SimilarTankRow = z.infer<typeof similarTank>;
