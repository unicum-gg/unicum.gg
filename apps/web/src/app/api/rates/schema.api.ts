// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

/** Response of `GET /rates`. */
export const ExchangeRatesResponse = z
  .object({
    base: z.string().meta({
      description:
        "ISO 4217 code the rates are quoted against. Always EUR: every amount this API reports money in is billed and collected in euros.",
    }),
    rates: z.record(z.string(), z.number()).meta({
      description:
        "ISO 4217 code to how many units of it one euro buys. Limited to the currencies the site displays, and always includes the base at 1.",
    }),
    updatedAt: z.iso.datetime().nullable().meta({
      description:
        "When the rates were last read from the provider, or null when no live rate is available. A null means only the base is present and amounts should be shown in euros rather than converted at a guess.",
    }),
  })
  .meta({
    id: "ExchangeRates",
    description:
      "Live EUR exchange rates used to display the site's own money figures (funding, infrastructure cost) in a visitor's regional currency.",
  });
