// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const supporterNameStyle = z
  .object({
    font: z.string().meta({
      description:
        "The typeface, by name (default, stencil, pixel, armour, script, …). An unknown one is drawn as the site's own.",
    }),
    effect: z.string().meta({
      description: "What is done with the colours: solid, gradient, neon, toon, pop, gummy or prism.",
    }),
    color: z.string().meta({ description: "The main colour, a name from the fixed palette." }),
    color2: z.string().meta({
      description: "The second colour, read by the gradient and pop effects only.",
    }),
  })
  .meta({
    id: "SupporterNameStyle",
    description: "How a supporter's nickname is drawn across the site.",
  });

const supporterSince = z
  .object({
    region: regionPath,
    accountId: z.number(),
    nickname: z.string(),
    since: z.coerce.date().meta({
      description:
        "When the supporter's current monthly pledge began. Cancelling and coming back starts it again.",
    }),
    style: supporterNameStyle.nullable().meta({
      description: "How their nickname is drawn. Null for a plain nickname.",
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
      "Every public supporter with the start of their current monthly pledge, which is what the supporter crest's metal is read from: bronze after 3 months, silver after 6, gold after 12. Each carries the style their nickname is drawn in, if they picked one. Anonymous supporters are not listed.",
  });
