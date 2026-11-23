// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

/** Response of `GET /{region}/clans/{tag}/supporters`. */
export const ClanSupportersResponse = z
  .object({
    supporters: z.number().meta({
      description:
        "Current members holding an active monthly pledge to unicum.gg that they count for this clan. Anonymous supporters are counted, since a number names nobody.",
    }),
  })
  .meta({
    id: "ClanSupporters",
    description:
      "How many of a clan's current members fund unicum.gg in its name. Zero for nearly every clan.",
  });
