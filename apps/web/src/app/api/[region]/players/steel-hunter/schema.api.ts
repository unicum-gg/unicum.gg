// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/** One row of the Steel Hunter (HR) leaderboard. Raw totals are included so
 * clients derive win rate / survival / avg damage without a second call. */
export const steelHunterSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    clan_tag: z.string().nullable(),
    clan_color: z.string().nullable(),
    // The Steel Hunter HR rating.
    hr: z.number(),
    // HRB, the battles-based Hunter Rating (rewards volume + winning).
    hrb: z.number(),
    battles: z.number(),
    wins: z.number(),
    survived: z.number(),
    damage: z.number(),
    frags: z.number(),
    is_verified: z.boolean().optional(),
    tournament_wins: z.number().optional().meta({
      description:
        "Tournaments this account was on the winning roster of, for the winner's crest.",
    }),
    tournament_featured_wins: z.number().optional(),
    tournament_best_title: z.string().nullable().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
  })
  .meta({
    id: "SteelHunterSummary",
    description: "Steel Hunter leaderboard row (ranked by HR).",
  });

/** Response of `GET /{region}/players/steel-hunter` (the Steel Hunter board). */
export const SteelHunterResponse = z.object({
  results: z.array(steelHunterSummary),
});
