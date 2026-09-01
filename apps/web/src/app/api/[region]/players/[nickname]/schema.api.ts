// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the player page parses with it.
import { z } from "zod";
import { MarkWindow } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

// --- Player detail (GET /api/{region}/players/{nickname}) ---
// Everything the player page renders, fully computed server-side (the
// encyclopedia and WN8/WNX expected-value tables never leave the server).
// camelCase + `z.coerce.date()` for the same reasons as the clan detail. The
// payload is metric-agnostic (liftDrag + ratingHistory carry all three
// metrics), so it takes no query params and the page is cacheable.

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

export const playerVehicle = z
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

// Lift/drag for one metric (null when the player has too few rated tanks).
const liftDragByMetricEntry = z
  .object({ lift: z.array(liftDragRow), drag: z.array(liftDragRow) })
  .nullable();

// Marks of Excellence / Mark of Mastery breakdown across the garage, plus the
// vehicles the player's current form puts within reach of the next mark.
const marksTierRow = z
  .object({
    tier: z.number(),
    none: z.number(),
    mark1: z.number(),
    mark2: z.number(),
    mark3: z.number(),
    total: z.number(),
  })
  .meta({
    id: "MarksTierRow",
    description:
      "How many of the player's vehicles of one tier carry no mark, one, two or three Marks of Excellence.",
  });

const masteryTierRow = z
  .object({
    tier: z.number(),
    none: z.number(),
    class3: z.number(),
    class2: z.number(),
    class1: z.number(),
    ace: z.number(),
    total: z.number(),
  })
  .meta({
    id: "MasteryTierRow",
    description:
      "How many of the player's vehicles of one tier carry no Mark of Mastery, 3rd, 2nd, 1st class or Ace Tanker.",
  });

const markReachEntry = z
  .object({
    tankId: z.number(),
    slug: z.string().nullable(),
    name: z.string(),
    tier: z.number(),
    tag: z.string(),
    type: z.string(),
    isPremium: z.boolean(),
    marks: z.number(),
    playingAt: z.number(),
    threshold: z.number(),
    combined: z.number(),
    ratio: z.number(),
    battles: z.number(),
    window: z.enum(MarkWindow).meta({
      description:
        "Which average the ratio was computed over: the last 30 days when the vehicle saw enough battles, its lifetime otherwise.",
      "x-enum-source": "MARK_WINDOW",
    } as EnumMeta),
  })
  .meta({
    id: "MarkReachEntry",
    description:
      "A vehicle measured against the mark it has not earned yet: the region's combined-damage bar for that mark, the player's own combined damage over the window, and their ratio. Above 1 means the average already clears the bar.",
  });

const markProgress = z
  .object({
    garage: z.number(),
    marks: z.object({
      total: z.object({
        mark1: z.number(),
        mark2: z.number(),
        mark3: z.number(),
      }),
      byTier: z.array(marksTierRow),
      known: z.number(),
    }),
    mastery: z.object({
      total: z.object({
        class3: z.number(),
        class2: z.number(),
        class1: z.number(),
        ace: z.number(),
      }),
      byTier: z.array(masteryTierRow),
    }),
    reach: z.array(markReachEntry),
  })
  .meta({
    id: "PlayerMarkProgress",
    description:
      "Marks of Excellence and Marks of Mastery across the garage, by tier, plus the vehicles closest to their next mark.",
  });

const ratingMetricValues = z.object({
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
});

const ratingHistoryPoint = z
  .object({
    day: z.string(),
    lifetime: ratingMetricValues,
    session: ratingMetricValues,
  })
  .meta({
    id: "RatingHistoryPoint",
    description:
      "Daily rating sample: lifetime and per-session values, each carrying all three metrics (wn7/wn8/wnx) so the client can switch metric without a refetch.",
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
      lastBattleAt: z.coerce.date().nullable(),
      updatedAt: z.coerce.date(),
    })
    .loose(),
  nameHistory: z
    .array(
      z.object({
        nickname: z.string(),
        recordedAt: z.coerce.date(),
      }),
    )
    .meta({
      description:
        "Previous nicknames of this account, newest first. Empty until a rename is observed (WG exposes no historical names).",
    }),
  isSupporter: z.boolean(),
  isVerified: z.boolean(),
  twitchLogin: z.string().nullable(),
  current: playerStats,
  periods: z.object({
    h24: playerStats.nullable(),
    d7: playerStats.nullable(),
    d30: playerStats.nullable(),
  }),
  derived: playerDerivedStats,
  tankCount: z.number(),
  achievementCount: z.number(),
  valuation: z
    .object({
      market: z.object({
        amount: z.number(),
        content: z.number(),
        tierX: z.number(),
        premiums: z.number(),
        rewards: z.number(),
        marks: z.number(),
        skillPremium: z.number(),
        depthBonus: z.number(),
        rewardCount: z.number(),
        tierXCount: z.number(),
        premiumCount: z.number(),
        mark3Count: z.number(),
        wgr: z.number(),
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
        "Estimated account worth: market resale value (modelled from grey-market listings, driven mostly by the WG global rating and battle count, with the garage as a small floor) and the store rebuild cost.",
    }),
  liftDrag: z.object({
    wn7: liftDragByMetricEntry,
    wn8: liftDragByMetricEntry,
    wnx: liftDragByMetricEntry,
  }),
  // Optional: a payload cached under the previous shape (60s TTL at most) has
  // no such field, and the panel reads its absence as "not computed yet".
  markProgress: markProgress.optional(),
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
