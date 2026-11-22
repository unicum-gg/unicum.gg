// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
//
// Sub-schemas are named after this endpoint: the generator resolves a schema's
// local consts by NAME across files, so a bare `stats` would merge with
// another endpoint's.
import { z } from "zod";

const playerSkirmishTierStats = z
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
  .meta({
    id: "PlayerSkirmishTierStats",
    description: "Skirmish totals at one tier, same fields as `StrongholdStats`.",
  });

const playerSkirmishTierPeriods = z
  .object({
    h24: playerSkirmishTierStats.nullable(),
    d7: playerSkirmishTierStats.nullable(),
    d30: playerSkirmishTierStats.nullable(),
  })
  .meta({
    id: "PlayerSkirmishTierPeriods",
    description:
      "What the tier gained over the last 24 hours, 7 days and 30 days. Null where our per-tier history does not reach back that far yet: it began in November 2026 and cannot be reconstructed before it.",
  });

const playerSkirmishTier = z
  .object({
    tier: z.number().nullable().meta({
      description:
        "The tier the skirmishes were fought at (6, 8, 10 or 11). Null for the battles on vehicles of any other tier, from the years when a skirmish capped the tier (I-VI, I-VIII, I-X) instead of fixing it.",
    }),
    vehicles: z.number().meta({
      description: "How many of the player's vehicles carry these battles.",
    }),
    stats: playerSkirmishTierStats,
    periods: playerSkirmishTierPeriods,
  })
  .meta({
    id: "PlayerSkirmishTier",
    description: "The player's Skirmishes at one tier.",
  });

// No `.meta({ id })` here: the generator names a component after the exported
// const, and declaring the same id again drops the whole `.meta`.
export const PlayerSkirmishResponse = z
  .object({
    accountId: z.number(),
    nickname: z.string(),
    tiers: z.array(playerSkirmishTier).meta({
      description:
        "One entry per tier played, in tier order, the older formats last. Empty for a player who never fought a skirmish.",
    }),
  })
  .meta({
    description:
      "A player's Skirmishes split by tier, rebuilt from their per-vehicle records.",
  });
