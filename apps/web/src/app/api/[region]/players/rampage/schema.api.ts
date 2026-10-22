// Co-located response schema. The `.api.ts` suffix is required so
// next-openapi-gen scans it (it scans route.ts + `.ts` files whose name
// contains "api"); a plain `schema.ts` resolves by name but builds empty.
import { z } from "zod";

/** One row of the Rampage (MR) leaderboard. Raw totals are included so
 * clients derive win rate / survival / avg damage without a second call. */
export const rampageSummary = z
  .object({
    account_id: z.number(),
    nickname: z.string(),
    clan_tag: z.string().nullable(),
    clan_color: z.string().nullable(),
    // MR, the mode rating: average XP and win rate, each against Rampage's own
    // population median, braked by battle volume. 1000 is the median player.
    mr: z.number(),
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
    onslaught_best_tier: z.string().nullable().optional(),
    onslaught_best_rank: z.number().nullable().optional(),
    onslaught_seasons: z.number().optional(),
    is_supporter: z.boolean().optional(),
    twitch_login: z.string().nullable().optional(),
  })
  .meta({
    id: "RampageSummary",
    description: "Rampage leaderboard row (ranked by MR).",
  });

/** Response of `GET /{region}/players/rampage` (the Rampage board). */
export const RampageResponse = z.object({
  results: z.array(rampageSummary),
  // The board ranks straight off `*_players`, so the rows are as of the read.
  computed_at: z.string().nullable(),
});
