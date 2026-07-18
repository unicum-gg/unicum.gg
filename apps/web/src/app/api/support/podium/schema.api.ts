// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const podiumSupporter = z
  .object({
    rank: z.number(),
    name: z
      .string()
      .meta({ description: 'Supporter Wargaming nickname, or "Anonymous".' }),
    anonymous: z.boolean(),
  })
  .meta({
    id: "PodiumSupporter",
    description:
      "One supporter on the podium, ranked by current monthly pledge. The amount is never exposed.",
  });

/** Response of `GET /support/podium`. */
export const SupportersPodiumResponse = z
  .object({
    supporters: z.array(podiumSupporter),
    monthlyPledgedCents: z.number().meta({
      description:
        "Total monthly pledge across all active supporters, in EUR cents (aggregate only, for the funding bar).",
    }),
    receivedCents: z.number().meta({
      description:
        "Total amount received from supporters since launch, in EUR cents (aggregate only, for the cumulative funding bar).",
    }),
  })
  .meta({
    id: "SupportersPodium",
    description:
      'Active supporters ranked by current monthly pledge, highest first. Individual amounts are never exposed; anonymous supporters appear as "Anonymous".',
  });
