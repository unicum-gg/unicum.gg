// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";
import { clanRankBadge } from "@/services/openapi/schemas";

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
    battles: z.number().meta({
      description: "Battles over the selected period.",
    }),
    wins: z.number().meta({
      description: "Wins over the selected period.",
    }),
    personalRating: z.number().nullable().meta({
      description: "Median WG Personal Rating (WGR) of the clan's roster.",
    }),
    boostRatio: z.number().nullable().meta({
      description:
        "Share of the roster (0..1) that reads as boost accounts (few random battles). Higher discounts SR.",
    }),
    sr: z.number().nullable().meta({
      description:
        "Composite skirmish rating: roster strength (median Personal Rating) weighted by win rate, battle volume and roster maturity over the selected period.",
    }),
    srb: z.number().nullable().meta({
      description:
        "Battles-based Stronghold Rating: SR bumped by battle volume (SR times 1 + ln(1 + battles/1000)), one absolute scale across tiers.",
    }),
    badges: z.array(clanRankBadge).optional().meta({
      description:
        "Leaderboard placings the clan currently holds, best rank first.",
    }),
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
  sort: z.enum(["sr", "srb", "elo", "battles", "winrate"]).optional().meta({
    description: "Ranking column (default sr).",
  }),
  period: z.enum(["overall", "30d"]).optional().meta({
    description:
      "Window the stats are computed over: all-time or the last 30 days (default overall).",
  }),
});

/** Response of `GET /{region}/clans/stronghold/top`. */
export const StrongholdTopResponse = z.object({
  results: z.array(strongholdLeaderboardEntry),
});
