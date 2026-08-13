// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

// Defined here rather than imported from the player detail's schema: the
// generator cannot expand a schema it did not parse in this file, and the two
// carry the same shape for the same reason (all three metrics per point, so the
// client switches metric without a refetch).
const ratingMetricValues = z.object({
  wn7: z.number().nullable(),
  wn8: z.number().nullable(),
  wnx: z.number().nullable(),
});

const tankRatingHistoryPoint = z
  .object({
    day: z.string(),
    lifetime: ratingMetricValues,
    session: ratingMetricValues,
  })
  .meta({
    id: "TankRatingHistoryPoint",
    description:
      "Daily rating sample for one player on one vehicle: the value carried by every battle fought on it, and the value of the battles fought that day.",
  });

/**
 * Response of `GET /{region}/players/{nickname}/tanks/{slug}`.
 *
 * One player's record on one vehicle, in the shape of the game's own Service
 * Record, plus the three ratings the game has no notion of. camelCase like its
 * siblings under `/players/{nickname}`, which mirror the shared types rather
 * than Wargaming's own casing.
 *
 * A null is "we do not have that counter", not "zero". The columns behind the
 * damage ratio, the stuns and the armour figures were added to the snapshot
 * table after the fact and backfill as each player is refreshed, so an account
 * untouched since then answers with nulls there and full numbers elsewhere.
 */
export const PlayerTankDetailResponse = z
  .object({
    tankId: z.number(),
    slug: z.string().nullable(),
    name: z.string(),
    shortName: z.string().nullable(),
    tier: z.number().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    role: z.string().nullable(),
    isPremium: z.boolean(),
    isReward: z.boolean(),
    updatedAt: z.iso.datetime().meta({
      description: "When the snapshot these numbers come from was taken.",
    }),

    battles: z.number(),
    mom: z.number().nullable().meta({ description: "Mark of Mastery, 0-4." }),
    moe: z
      .number()
      .nullable()
      .meta({ description: "Marks of Excellence on the gun, 0-3." }),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),

    winrate: z
      .number()
      .meta({ description: "Ratio in 0..1, not a percentage." }),
    survivalRate: z.number().nullable(),
    hitRate: z.number().nullable(),
    damageRatio: z
      .number()
      .nullable()
      .meta({ description: "Damage dealt over damage taken." }),
    destructionRatio: z
      .number()
      .nullable()
      .meta({ description: "Frags over deaths. Null on a tank never lost." }),
    armorUseEfficiency: z
      .number()
      .nullable()
      .meta({ description: "Wargaming's own armour use factor." }),
    stuns: z.number().nullable(),

    avgXp: z.number().nullable(),
    avgDamage: z.number(),
    avgDamageReceived: z.number().nullable(),
    avgAssist: z.number(),
    avgAssistRadio: z.number(),
    avgAssistTrack: z.number(),
    avgAssistStun: z.number().nullable(),
    avgBlocked: z.number().nullable(),
    avgSpotted: z.number(),
    avgFrags: z.number(),
    avgCapture: z.number().nullable(),
    avgDefense: z.number(),
    avgStuns: z.number().nullable(),

    maxXp: z.number().nullable().meta({
      description: "Best single battle on the vehicle: the game's Record Score.",
    }),
    maxFrags: z.number().nullable(),

    ratingHistory: z.array(tankRatingHistoryPoint).meta({
      description: "Daily rating series for this player on this vehicle, over the last 90 days.",
    }),
  })
  .meta({
    id: "PlayerTankDetail",
    description: "One player's record on one vehicle.",
  });
