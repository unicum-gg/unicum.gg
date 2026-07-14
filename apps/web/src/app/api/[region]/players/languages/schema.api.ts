// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

export const languageStat = z
  .object({
    code: z.string().meta({ description: "Two-letter language code." }),
    total: z.number().meta({
      description: "Players/clans with this language among their declared ones.",
    }),
    strict: z.number().meta({
      description: "Players/clans whose clan declares only this language.",
    }),
  })
  .meta({ id: "LanguageStat", description: "One language's population." });

/** Response of `GET /{region}/players/languages`. */
export const PlayerLanguagesResponse = z.object({
  results: z.array(languageStat),
});
