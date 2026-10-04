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
      "One supporter on the board, ranked by the net total they have given since launch. The amount is never exposed.",
  });

/** Response of `GET /support/podium`. */
export const SupportersPodiumResponse = z
  .object({
    supporters: z.array(podiumSupporter),
    monthlyPledgedCents: z.number().meta({
      description:
        "Total monthly pledge across all active supporters, in EUR cents (aggregate only, for the funding bar's run-rate line). One-off donations are not in it: it answers what recurs every month, not what came in.",
    }),
    receivedCents: z.number().meta({
      description:
        "Total amount received from supporters since launch, net of refunds, in EUR cents (aggregate only, for the cumulative funding bar). Monthly charges and one-off donations alike.",
    }),
  })
  .meta({
    id: "SupportersPodium",
    description:
      'Everyone who has contributed, ranked by the net total given since launch, highest first. Individual amounts are never exposed; anonymous supporters appear as "Anonymous".',
  });
