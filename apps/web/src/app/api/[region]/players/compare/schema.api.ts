// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const compareSlot = z.object({
  requested: z.string().meta({ description: "The nickname as requested." }),
  player: z.looseObject({}).nullable().meta({
    description: "The tracked player row (null when unknown to the tracker).",
  }),
  latest: z.looseObject({}).nullable().meta({
    description: "The player's latest snapshot (null when never snapped).",
  }),
  tanks: z.array(z.looseObject({})).meta({
    description: "Raw per-tank stats (WN8/WNX inputs).",
  }),
});

/** Response of `GET /{region}/players/compare`: everything the side-by-side
 * comparison computes from, per requested player. */
export const PlayersCompareResponse = z
  .object({
    slots: z.array(compareSlot),
    encyclopedia: z.record(z.string(), z.looseObject({})).meta({
      description: "Vehicle catalogue keyed by tank id.",
    }),
    wn8Expected: z.record(z.string(), z.looseObject({})).meta({
      description: "WN8 expected values keyed by tank id.",
    }),
    wnxExpected: z.record(z.string(), z.looseObject({})).meta({
      description: "WNX expected values keyed by tank id.",
    }),
  })
  .meta({
    id: "PlayersCompare",
    description:
      "Inputs for a side-by-side player comparison: each player's row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and WN8/WNX expected-value tables.",
  });
