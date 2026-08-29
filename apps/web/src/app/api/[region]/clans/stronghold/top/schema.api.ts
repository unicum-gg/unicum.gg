// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";
import { type EnumMeta, clanRankBadge } from "@/services/openapi/schemas";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/shared";

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

// The domain enums are passed straight to `z.enum`, and the spec's values are
// filled after generation from the `x-enum-source` markers (see
// `services/openapi/enum-sources`). These were hand-typed literals, which is how
// the `period` param stayed at "overall | 30d" after two windows were added to
// `StrongholdPeriod`, the SDK's generated type contradicted the enum and only
// tsc at the call site caught it.
export const strongholdTopQuery = z.object({
  tier: z.enum(StrongholdTier).optional().meta({
    description: "Stronghold mode/tier (default t10).",
    "x-enum-source": "STRONGHOLD_TIER",
  } as EnumMeta),
  sort: z.enum(StrongholdSort).optional().meta({
    description: "Ranking column (default sr).",
    "x-enum-source": "STRONGHOLD_SORT",
  } as EnumMeta),
  period: z.enum(StrongholdPeriod).optional().meta({
    description:
      "Window the stats are computed over: the last 24 hours, 7 days, 30 days, or all-time (default overall).",
    "x-enum-source": "STRONGHOLD_PERIOD",
  } as EnumMeta),
});

/** Response of `GET /{region}/clans/stronghold/top`. */
export const StrongholdTopResponse = z.object({
  results: z.array(strongholdLeaderboardEntry),
});
