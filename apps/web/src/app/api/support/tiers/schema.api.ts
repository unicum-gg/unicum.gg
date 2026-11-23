// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const supporterSince = z
  .object({
    region: regionPath,
    accountId: z.number(),
    nickname: z.string(),
    since: z.coerce.date().meta({
      description:
        "When the supporter's current monthly pledge began. Cancelling and coming back starts it again.",
    }),
  })
  .meta({
    id: "SupporterSince",
    description: "One public supporter and how long they have held their monthly pledge.",
  });

/** Response of `GET /support/tiers`. */
export const SupporterTiersResponse = z
  .object({
    supporters: z.array(supporterSince),
  })
  .meta({
    id: "SupporterTiers",
    description:
      "Every public supporter with the start of their current monthly pledge, which is what the supporter crest's metal is read from: bronze after 3 months, silver after 6, gold after 12. Anonymous supporters are not listed.",
  });
