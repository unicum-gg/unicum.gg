// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const clanCompareSlot = z.object({
  requested: z.string().meta({ description: "The clan tag as requested." }),
  clan: z.looseObject({}).nullable().meta({
    description: "The clan's profile (null when unknown).",
  }),
  members: z.array(z.looseObject({})).meta({
    description: "Members with cached WN7/WN8/WNX ratings.",
  }),
  tankAggregates: z.array(z.looseObject({})).meta({
    description: "Per-tank aggregates across the clan's members.",
  }),
});

/** Response of `GET /{region}/clans/compare`. */
export const ClansCompareResponse = z
  .object({
    slots: z.array(clanCompareSlot),
    encyclopedia: z.record(z.string(), z.looseObject({})),
    wn8Expected: z.record(z.string(), z.looseObject({})),
    wnxExpected: z.record(z.string(), z.looseObject({})),
    wn8Fallback: z.record(z.string(), z.looseObject({})).meta({
      description:
        "Precomputed WN8 fallback (per tier+type average) for fielded tanks missing from the expected table, keyed by `tier-type`.",
    }),
  })
  .meta({
    id: "ClansCompare",
    description:
      "Inputs for a side-by-side clan comparison: each clan's profile, rated members and per-tank aggregates, plus the vehicle catalogue and WN8/WNX expected-value tables.",
  });
