// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const strongholdLeaderboardEntry = z
  .object({
    clanId: z.number(),
    tag: z.string(),
    name: z.string(),
    color: z.string(),
    emblem: z.string(),
    languages: z.array(z.string()),
    membersCount: z.number(),
    elo: z.number().nullable().meta({
      description: "Tier Elo (null for Advances, which has no Elo).",
    }),
    battles: z.number(),
    battles30d: z.number().nullable(),
    wins: z.number(),
    wins30d: z.number().nullable(),
  })
  .meta({
    id: "StrongholdLeaderboardEntry",
    description: "One clan on the stronghold leaderboard.",
  });

// Inline literals: locked to `StrongholdTier` / `StrongholdSort` in
// `@unicum.gg/shared/constants/stronghold`.
export const strongholdTopQuery = z.object({
  tier: z.enum(["advances", "t10", "t8", "t6"]).optional().meta({
    description: "Stronghold mode/tier (default t10).",
  }),
  sort: z
    .enum(["elo", "battles", "battles30d", "winrate30d", "winrate"])
    .optional()
    .meta({
      description: "Ranking column (default elo; battles for Advances).",
    }),
});

/** Response of `GET /{region}/clans/stronghold/top`. */
export const StrongholdTopResponse = z.object({
  results: z.array(strongholdLeaderboardEntry),
});
