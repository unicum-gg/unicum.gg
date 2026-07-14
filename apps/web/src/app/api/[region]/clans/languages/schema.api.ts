// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const clanLanguageStat = z.object({
  code: z.string().meta({ description: "Two-letter language code." }),
  total: z.number(),
  strict: z.number(),
});

/** Response of `GET /{region}/clans/languages`. */
export const ClanLanguagesResponse = z.object({
  results: z.array(clanLanguageStat),
});
