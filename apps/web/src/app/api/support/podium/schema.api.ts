// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const podiumSupporter = z
  .object({
    rank: z.number(),
    name: z
      .string()
      .meta({ description: 'Supporter Wargaming nickname, or "Anonymous".' }),
    anonymous: z.boolean(),
    region: regionPath.nullable().meta({
      description:
        "Realm the supporter's account lives on, so their name can link to their profile. Null for an anonymous supporter, and for an account whose Wargaming link cannot be read: either way the name renders as plain text.",
    }),
  })
  .meta({
    id: "PodiumSupporter",
    description:
      "One supporter on the board, ranked by the net total they have given since launch. The amount is never exposed.",
  });

/** One row of the supporters board. */
export type PodiumSupporter = z.infer<typeof podiumSupporter>;

const podiumClan = z
  .object({
    rank: z.number(),
    region: regionPath,
    id: z.number().meta({ description: "Wargaming clan id." }),
    tag: z.string(),
    color: z.string().meta({ description: "The clan's colour, as a CSS hex." }),
    supporters: z.number().meta({
      description:
        "Current members who have given something and count it for this clan.",
    }),
  })
  .meta({
    id: "PodiumClan",
    description:
      "One clan on the clans board, ranked by what its current members have given in total and counted for it. The amount is never exposed.",
  });

/** One row of the clans board. */
export type PodiumClan = z.infer<typeof podiumClan>;

/** Response of `GET /support/podium`. */
export const SupportersPodiumResponse = z
  .object({
    supporters: z.array(podiumSupporter),
    clans: z.array(podiumClan).meta({
      description:
        "The clans board: clans whose current members count their support for them, ranked by the net total those members have given. A member who leaves takes their share with them.",
    }),
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
