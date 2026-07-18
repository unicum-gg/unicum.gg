// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

/** Response of `GET /support/funding`. */
export const FundingSummaryResponse = z
  .object({
    pct: z.number().meta({
      description:
        "Share of the cumulative infrastructure spend since launch that supporters have covered, 0-100.",
    }),
    receivedUsd: z.number().meta({
      description: "Total received from supporters since launch, in USD.",
    }),
    goalUsd: z.number().meta({
      description: "Cumulative infrastructure spend since launch, in USD.",
    }),
  })
  .meta({
    id: "FundingSummary",
    description:
      "Compact funding progress for the top-bar bar: how much of what has been spent since launch the community has covered. Amounts are aggregate only.",
  });
