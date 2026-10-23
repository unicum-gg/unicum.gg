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

const markReach = z
  .object({
    combined: z.number(),
    battles: z.number(),
    window: z.enum(MarkWindow).meta({
      description:
        "Which average `combined` was taken over: the last 30 days when the vehicle saw enough battles, its lifetime otherwise.",
      "x-enum-source": "MARK_WINDOW",
    } as EnumMeta),
    mark1: z.number(),
    mark2: z.number(),
    mark3: z.number(),
  })
  .meta({
    id: "TankMarkReach",
    description:
      "Where the account's own combined damage sits against the region's three Marks of Excellence bars on this vehicle: `combined` over `markN` is how much of that mark's bar the player's average covers, and 1 or more means it already clears it. Null where no honest reading exists: below tier 5 (the game awards no marks there), under 25 battles on the vehicle, or when the region has no usable bars for it. This is an average against a published bar, never the game's own rolling-window progress, which is `moePercent`.",
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
    // Optional for the reason `breakdown` is below: a response cached under the
    // previous shape carries no such field, and the client parses this schema,
    // so a required one would throw on every hit until the cache turned over.
    // Absent reads as unverified, which is what it was.
    owned: z
      .boolean()
      .nullable()
      .optional()
      .meta({ description: "Whether the account still holds this vehicle. Null means nobody has verified that garage: Wargaming answers `in_garage` null for every caller but the account itself, so a vehicle sold years ago is indistinguishable from one still owned. Only a player who has signed in with Wargaming.net ID can turn this into a real boolean, and when they have, a false row is a vehicle they no longer have." }),
    mom: z.number().nullable(),
    moe: z.number().nullable(),
    moePercent: z
      .number()
      .nullable()
      .meta({ description: "Progress towards the next mark of excellence, 0-100 with two decimals. Only ever known for an account running the mod: the value lives in the client's own vehicle dossier and is in neither the public API nor the portal. Null when nobody has reported it." }),
    // Optional for the reason `owned` above is: a response cached under the
    // previous shape carries no such field and the client parses this schema.
    markReach: markReach.nullable().optional(),
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
      "A tank in the player's record, with per-battle averages and WN7/WN8/WNX ratings. Normally a tank they have battles in, which is all Wargaming publishes about a stranger. On an account whose owner has signed in here, the list is their actual garage instead: vehicles they have sold are marked `owned: false`, and vehicles they own but have never driven appear with zero battles and null averages.",
  });

const liftDragRow = z
  .object({
    tankId: z.number(),
    slug: z.string().nullable(),
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
        // Whether the clan has since been disbanded, resolved per request
        // rather than stored on the stint. Documented rather than left to
        // `.loose()`: the front draws the stint struck through from it and
        // links it by `TAG-<id>` instead of the bare tag, so an undocumented
        // field would be missing from the generated SDK types and one
        // tightening away from silently turning every archive link back into a
        // tag that now belongs to someone else.
        isDisbanded: z.boolean().optional(),
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

// One line of the rebuild cost: the vehicles it pays for, the amount in the game
// currency it is paid in, that amount in gold, and the store price of that gold.
const rebuildLine = z.object({
  count: z.number(),
  units: z.number(),
  gold: z.number(),
  amount: z.number(),
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
  tournamentWins: z.number().meta({
    description:
      "How many Wargaming tournaments this account was on the winning roster of. Counts only tournaments that decided an overall winner: a draw played as parallel groups crowns a winner per group and none overall.",
  }),
  tournamentFeaturedWins: z.number().meta({
    description:
      "How many of those wins came at an event Wargaming flags as featured, which is what separates a branded championship from a nightly gold ladder.",
  }),
  tournamentBestTitle: z.string().nullable().meta({
    description:
      "The win worth naming: a featured event when there is one, else the most recent. Null when the account has never won.",
  }),
  onslaughtBestTier: z.string().nullable().meta({
    description:
      "The best Onslaught rank this account has ever held: legend, champion, or null for an account that has never been on the ranked board. A record rather than a current standing: a rating falling back under the entry bar takes the place, not the fact that it was held.",
  }),
  onslaughtBestRank: z.number().nullable().meta({
    description:
      "The best leaderboard position held, across every season captured. Null when the account has never been ranked.",
  }),
  onslaughtSeasons: z.number().meta({
    description:
      "How many distinct Onslaught seasons this account was ranked in. Zero for an account that never was.",
  }),
  current: playerStats,
  periods: z.object({
    h24: playerStats.nullable(),
    d7: playerStats.nullable(),
    d30: playerStats.nullable(),
  }),
  derived: playerDerivedStats,
  tankCount: z.number(),
  achievementCount: z.number(),
  tournamentCount: z.number(),
  battleCount: z.number().optional().meta({
    description:
      "Battles shared through the unicum.gg mod that this account fought. Absent from a payload cached before the field existed.",
  }),
  valuation: z
    .object({
      account: z
        .object({
          amount: z.number(),
          currency: z.string(),
          verifiedAt: z.string().nullable().optional(),
          breakdown: z
            .object({
              gold: z.number(),
              research: rebuildLine,
              credits: rebuildLine,
              premiums: rebuildLine,
            })
            .optional(),
        })
        .nullable(),
    })
    .meta({
      description:
        "What this garage would cost to rebuild at the official store, in the region's store currency: every non-reward tank's gold price, or its research XP and credit price converted through gold. Reward tanks are excluded: the shop never prices them, since they are issued through Wargaming's own events (auctions and paid Battle Pass tiers among others) at whatever it asks each time rather than at a published price. Null for a region with no store pricing table. `breakdown` is how that total is reached, in three lines that sum to it exactly, each carrying the raw game currency behind it. `verifiedAt` is when the account's own owner last confirmed their garage by signing in with Wargaming.net ID, and it is what separates a figure from an estimate: null means this prices every vehicle the account has ever DRIVEN, because `in_garage` is null for any caller but the account itself, so vehicles sold years ago are still counted and vehicles bought and never driven are missing entirely.",
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
  strongholds: z
    .object({
      skirmish: strongholdMode,
      fortified: strongholdMode,
      epic: strongholdMode,
      ranked: strongholdMode,
      fallout: strongholdMode,
      cwAbsolute: strongholdMode,
      cwChampion: strongholdMode,
      cwMiddle: strongholdMode,
      clan: strongholdMode.nullable(),
      company: strongholdMode.nullable(),
      team: strongholdMode.nullable(),
      regularTeam: strongholdMode.nullable(),
      historical: strongholdMode.nullable(),
    })
    .meta({
      description:
        "Per-mode records. The first eight are live modes read from the snapshot series, so they carry 24h/7d/30d periods. The last five are modes nobody can play any more (Clan Battles, Tank Company, Team Battles, Permanent Teams and Historical Battles): their totals are finished, so their periods are always null, and the whole entry is null for an account that never played the mode.",
    }),
});
