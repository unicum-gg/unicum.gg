// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod + the shared metricField): the player page parses with it.
import { z } from "zod";
import { metricField } from "@/services/openapi/schemas";

// --- Player detail (GET /api/{region}/players/{nickname}) ---
// Everything the player page renders, fully computed server-side (the
// encyclopedia and WN8/WNX expected-value tables never leave the server).
// camelCase + `z.coerce.date()` for the same reasons as the clan detail.

export const playerDetailQuery = z.object({
  metric: metricField.optional(),
});

const playerStats = z
  .object({
    battles: z.number(),
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    survivedBattles: z.number(),
    frags: z.number(),
    damageDealt: z.number(),
    xp: z.number(),
    spotted: z.number(),
    capturePoints: z.number(),
    droppedCapturePoints: z.number(),
    hits: z.number(),
    shots: z.number(),
    globalRating: z.number(),
    wtr: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "PlayerStats",
    description:
      "Random-battles totals (or a period diff of them) from a snapshot.",
  });

const periodValues = z
  .object({
    total: z.number().nullable(),
    h24: z.number().nullable(),
    d7: z.number().nullable(),
    d30: z.number().nullable(),
  })
  .meta({
    id: "PeriodValues",
    description: "One derived value per column: lifetime, 24h, 7d, 30d.",
  });

const playerDerivedStats = z
  .object({
    tier: periodValues,
    trackDamage: periodValues,
    spottingDamage: periodValues,
    assistingDamage: periodValues,
    combinedDamage: periodValues,
    wn7: periodValues,
    wn8: periodValues,
    wnx: periodValues,
  })
  .loose()
  .meta({
    id: "PlayerDerivedStats",
    description:
      "Per-tank-breakdown derivations: average tier, assistance damages and WN7/WN8/WNX per column.",
  });

const playerVehicle = z
  .object({
    tankId: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    tag: z.string().nullable(),
    tier: z.number().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    isPremium: z.boolean(),
    mom: z.number().nullable(),
    moe: z.number().nullable(),
    battles: z.number(),
    avgDamage: z.number().nullable(),
    avgXp: z.number().nullable(),
    winrate: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    buyGold: z.number().nullable(),
    buyCredits: z.number().nullable(),
    researchXp: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "PlayerVehicle",
    description:
      "A tank the player has battles in, with per-battle averages and WN7/WN8/WNX ratings.",
  });

const liftDragRow = z
  .object({
    tankId: z.number(),
    name: z.string(),
    tag: z.string(),
    type: z.string(),
    tier: z.number(),
    isPremium: z.boolean(),
    battles: z.number(),
    rating: z.number(),
    removalDelta: z.number(),
  })
  .loose()
  .meta({
    id: "LiftDragRow",
    description:
      "A tank whose removal would move the overall rating by removalDelta (negative = it lifts the rating, positive = it drags it).",
  });

const ratingHistoryPoint = z
  .object({
    day: z.string(),
    lifetime: z.number().nullable(),
    session: z.number().nullable(),
  })
  .meta({
    id: "RatingHistoryPoint",
    description:
      "Daily rating sample: lifetime value plus the per-session value computed from that day's battles.",
  });

const clanStint = z
  .object({
    clan: z
      .object({
        id: z.number(),
        tag: z.string(),
        name: z.string(),
        color: z.string(),
        emblem: z.string(),
        languages: z.array(z.string()),
      })
      .loose(),
    joinedAt: z.coerce.date(),
    leftAt: z.coerce.date().nullable(),
    role: z.string(),
    roleLocalized: z.string(),
  })
  .loose()
  .meta({
    id: "ClanStint",
    description: "A period of membership in one clan.",
  });

const playerClanHistory = z
  .object({
    currentStint: clanStint.nullable(),
    pastStints: z.array(clanStint),
    totalClans: z.number(),
    timeInClansSeconds: z.number(),
  })
  .loose()
  .meta({
    id: "PlayerClanHistory",
    description: "Current and past clan memberships.",
  });

const strongholdStats = z
  .object({
    battles: z.number(),
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    survivedBattles: z.number(),
    frags: z.number(),
    damageDealt: z.number(),
    spotted: z.number(),
    capturePoints: z.number(),
    droppedCapturePoints: z.number(),
    battleAvgXp: z.number(),
  })
  .loose()
  .meta({
    id: "StrongholdStats",
    description: "Totals for one non-random game mode.",
  });

const strongholdMode = z
  .object({
    current: strongholdStats.nullable(),
    periods: z.object({
      h24: strongholdStats.nullable(),
      d7: strongholdStats.nullable(),
      d30: strongholdStats.nullable(),
    }),
  })
  .meta({
    id: "StrongholdMode",
    description: "One game mode's totals plus 24h/7d/30d period diffs.",
  });

// Per-tier contribution of a valuation group (reward tanks, N-mark tanks).
const tierContribution = z.object({
  tier: z.number(),
  count: z.number(),
  unit: z.number(),
  value: z.number(),
});

export const PlayerDetailResponse = z.object({
  player: z
    .object({
      accountId: z.number(),
      nickname: z.string(),
      createdAt: z.coerce.date(),
      lastBattleAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
    .loose(),
  metric: metricField,
  current: playerStats,
  periods: z.object({
    h24: playerStats.nullable(),
    d7: playerStats.nullable(),
    d30: playerStats.nullable(),
  }),
  derived: playerDerivedStats,
  vehicles: z.array(playerVehicle),
  valuation: z
    .object({
      market: z.object({
        amount: z.number(),
        base: z.number(),
        tierX: z.number(),
        premiums: z.number(),
        rewards: z.number(),
        marks: z.number(),
        subtotal: z.number(),
        statMultiplier: z.number(),
        statConfidence: z.number(),
        rewardCount: z.number(),
        tierXCount: z.number(),
        premiumCount: z.number(),
        mark3Count: z.number(),
        wn8: z.number().nullable(),
        battles: z.number(),
        rewardsByTier: z.array(tierContribution),
        premiumsByTier: z.array(tierContribution),
        marks3ByTier: z.array(tierContribution),
        marks2ByTier: z.array(tierContribution),
      }),
      account: z
        .object({ amount: z.number(), currency: z.string() })
        .nullable(),
    })
    .meta({
      description:
        "Estimated account worth: market resale value (modelled from grey-market listings, driven by reward tanks, WN8 skill and marks) and the store rebuild cost.",
    }),
  liftDrag: z
    .object({ lift: z.array(liftDragRow), drag: z.array(liftDragRow) })
    .nullable(),
  ratingHistory: z.array(ratingHistoryPoint),
  clanHistory: playerClanHistory,
  strongholds: z.object({
    skirmish: strongholdMode,
    fortified: strongholdMode,
    epic: strongholdMode,
    ranked: strongholdMode,
    fallout: strongholdMode,
    cwAbsolute: strongholdMode,
    cwChampion: strongholdMode,
    cwMiddle: strongholdMode,
  }),
});
