// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { TankBattleMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

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

// The medals earned on this vehicle: the game's "Awards" tab. Same shape as the
// profile's cabinet, spelled out again because the generator only expands a
// schema it parsed in this file, and trimmed to what was earned rather than the
// whole 505-entry catalogue.
const tankAward = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    condition: z.string(),
    image: z.string(),
    section: z.string(),
    sectionName: z.string(),
    sectionOrder: z.number().int(),
    order: z.number().int(),
    type: z.string(),
    outdated: z.boolean(),
    tiers: z.array(z.object({ name: z.string(), image: z.string() })),
    count: z.number().int(),
  })
  .meta({
    id: "TankAward",
    description:
      "One medal earned on this vehicle. For a tiered medal the count is the tier reached, not a number of awards.",
  });

// One mode's slice of the record. The stat fields are spelled out again rather
// than shared with the object below, for the reason the two above are: the
// generator only expands a schema it parsed in this file. The vehicle metadata
// is deliberately absent, so a vehicle played in ten modes does not carry its
// own name ten times.
const tankModeRecord = z
  .object({
    mode: z.enum(TankBattleMode).meta({
      description:
        "Wargaming's own key for the battle mode. `random` is derived from the overall figures and the two other parts of them (`all` is `random` + `clan` + `company`, exactly); the rest are stored as reported.",
      "x-enum-source": "TANK_BATTLE_MODE",
    } as EnumMeta),
    retired: z.boolean().meta({
      description:
        "The mode is no longer played, so these numbers are an archive that can only shrink as accounts lapse.",
    }),
    multiVehicle: z.boolean().meta({
      description:
        "One battle is counted against every vehicle fielded in it, so these battles must never be summed into a mode total. True for Fallout, which allowed a lineup with respawns.",
    }),

    battles: z.number(),
    wn7: z.number().nullable().meta({
      description:
        "Null on every mode but `random`, along with `wn8` and `wnx`: the expected values behind them are measured on random battles.",
    }),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),

    winrate: z.number().meta({ description: "Ratio in 0..1, not a percentage." }),
    survivalRate: z.number().nullable(),
    hitRate: z.number().nullable(),
    damageRatio: z.number().nullable(),
    destructionRatio: z.number().nullable(),
    armorUseEfficiency: z.number().nullable(),
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

    maxXp: z.number().nullable(),
    maxFrags: z.number().nullable(),
    maxDamage: z.number().nullable(),
  })
  .meta({
    id: "PlayerTankModeRecord",
    description:
      "One player's record on one vehicle in one battle mode. `wn7`, `wn8` and `wnx` are null on every mode but `random`: all three are built against expected values measured on random battles, where a shorter tier-limited format and a win rate nowhere near 50% make them score a mode against a standard it was never set by.",
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
    moePercent: z
      .number()
      .nullable()
      .meta({ description: "Progress towards the next mark of excellence, 0-100 with two decimals. Only ever known for an account running the mod: the value lives in the client's own vehicle dossier and is in neither the public API nor the portal. Null when nobody has reported it." }),
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
    maxDamage: z.number().nullable().meta({
      description:
        "Always null on the overall record: Wargaming reports no best-damage figure outside the per-mode blocks, and answers 0 for Random Battles. See `modes[].maxDamage`, which carries it for every other mode.",
    }),

    ratingHistory: z.array(tankRatingHistoryPoint).meta({
      description: "Daily rating series for this player on this vehicle, over the last 90 days.",
    }),

    awards: z
      .array(tankAward)
      .nullable()
      .meta({
        description:
          "Medals earned on this vehicle, in the game's own cabinet order. Earned only, and null when they are not known for this player yet.",
      }),

    modes: z.array(tankModeRecord).meta({
      description:
        "Where those battles were fought, in mode order. Empty on a vehicle only ever taken into Random Battles (which is most of them) and on a record predating the breakdown being collected, which fills in on the player's next refresh: Wargaming reports lifetime totals, so there is nothing historical to backfill.",
    }),
  })
  .meta({
    id: "PlayerTankDetail",
    description: "One player's record on one vehicle.",
  });
