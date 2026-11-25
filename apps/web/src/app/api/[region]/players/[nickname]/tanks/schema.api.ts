// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the player page parses the response with it.
import { z } from "zod";
import { MarkWindow, StatWindowUnit, TankBattleMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

// --- Player tanks (GET /api/{region}/players/{nickname}/tanks) ---
// The heavy tank-by-tank list, loaded on demand (it is ~92% of the former
// detail payload but only the Tanks section renders it).

/** The mode field, spelled once and used by both the query and the response, so
 * the two cannot name different value sets. */
const battleMode = z.enum(TankBattleMode).meta({
  description:
    "Wargaming's own key for the battle mode. `random` is derived from the overall figures and the two other parts of them (`all` is `random` + `clan` + `company`, exactly); the rest are stored as reported.",
  "x-enum-source": "TANK_BATTLE_MODE",
} as EnumMeta);

/**
 * Which battle mode the rows should describe.
 *
 * Omitted means the vehicle's whole record, which is what the endpoint has
 * always answered and what the rest of the site shows: the `all` block, Random
 * plus the two retired ladders folded into it. A mode narrows every row to that
 * mode's counters AND drops the vehicles the player never took into it, which
 * is the point of asking.
 *
 * Never rejected: an unknown value answers the overall list rather than 400, so
 * a mode Wargaming retires cannot break a bookmarked URL.
 */
export const playerTanksQuery = z.object({
  mode: battleMode.optional(),
  days: z.coerce.number().int().min(1).max(365).optional().meta({
    description:
      "Read every row over the last N days (1 to 365) instead of the vehicle's career. Give at most one of this or `battles`. Random Battles only: ignored under any other `mode`.",
  }),
  battles: z.coerce.number().int().min(1).max(10000).optional().meta({
    description:
      "Read every row over the player's last N battles (1 to 10000) instead of the vehicle's career. Give at most one of this or `days`. Random Battles only: ignored under any other `mode`.",
  }),
});

/** One mode this player has a record in, for the table's own selector. */
const playerTankModeOption = z
  .object({
    mode: battleMode,
    tanks: z.number().int().meta({
      description:
        "Vehicles this player has a record on in this mode. Vehicles rather than battles on purpose: a multi-vehicle mode counts one battle against every vehicle fielded in it, so a battle total over vehicles would be inflated for that mode alone.",
    }),
    retired: z.boolean(),
    multiVehicle: z.boolean(),
  })
  .meta({
    id: "PlayerTankModeOption",
    description: "A battle mode this player's garage has a record in.",
  });

/**
 * Where each account's own combined damage sits against the region's Marks of
 * Excellence bars, transposed like the list around it.
 *
 * Read as present for a vehicle where its `window` is: the five figures beside
 * it are numbers a vehicle without a comparison genuinely has none of, so only
 * the window says whether the comparison was made at all.
 */
const markReachColumns = z
  .object({
    combined: z.array(z.number().nullable()).nullable(),
    battles: z.array(z.number().nullable()).nullable(),
    window: z.array(z.enum(MarkWindow).nullable()).nullable().meta({
      description:
        "Which average `combined` was taken over, per vehicle: the last 30 days when the vehicle saw enough battles, its lifetime otherwise. Null where no comparison exists for that vehicle.",
      "x-enum-source": "MARK_WINDOW",
    } as EnumMeta),
    mark1: z.array(z.number().nullable()).nullable(),
    mark2: z.array(z.number().nullable()).nullable(),
    mark3: z.array(z.number().nullable()).nullable(),
  })
  .nullable()
  .meta({
    id: "TankMarkReachColumns",
    description:
      "Where the account's own combined damage sits against the region's three Marks of Excellence bars on each vehicle: `combined` over `markN` is how much of that mark's bar the player's average covers, and 1 or more means it already clears it. A vehicle's entry is absent (null in every column) where no honest reading exists: below tier 5 (the game awards no marks there), under 25 battles on the vehicle, or when the region has no usable bars for it. This is an average against a published bar, never the game's own rolling-window progress, which is `moePercent`. The whole object is null when no vehicle in the garage has a comparison.",
  });

/** A windowed list's career figures per vehicle, transposed like the rows. */
const careerColumns = z
  .object({
    battles: z.array(z.number().nullable()).nullable(),
    avgDamage: z.array(z.number().nullable()).nullable(),
    avgXp: z.array(z.number().nullable()).nullable(),
    winrate: z.array(z.number().nullable()).nullable(),
    wn7: z.array(z.number().nullable()).nullable(),
    wn8: z.array(z.number().nullable()).nullable(),
    wnx: z.array(z.number().nullable()).nullable(),
  })
  .nullable()
  .meta({
    id: "TankCareerColumns",
    description:
      "On a windowed list (`days` or `battles`), each vehicle's whole record, aligned with the rows: what the window's figures are read against. Null on the career list.",
  });

/**
 * The garage as one array per field rather than one object per vehicle.
 *
 * **Because a field name costs as much as the number beside it.** Measured on a
 * 972-vehicle garage, the row-per-vehicle form came to 535,227 octets of which
 * 251,748 were the twenty-seven field names, written once per vehicle. This
 * shape is 198,708 for the same list, and the figures are rounded to the
 * precision the site actually displays (averages and ratings to the unit, a win
 * rate to two decimals of a percent), which is the other half of the saving.
 * `playerTankRows` in `@unicum.gg/shared` turns it back into the rows.
 *
 * Every column is published. A column reads null when no vehicle in the list
 * carries that field at all, which on a stranger's garage is `owned` (nobody
 * has verified it) and `moePercent` (nobody is running the mod), and on an
 * empty one is every column.
 *
 * Each column has one entry per vehicle, in one order, so `tankId[i]` and
 * `battles[i]` are the same vehicle. `tankId` is the one column a vehicle
 * always has, so it is what says how many there are.
 */
const playerVehicleColumns = z
  .object({
    tankId: z.array(z.number().nullable()).nullable(),
    slug: z.array(z.string().nullable()).nullable(),
    name: z.array(z.string().nullable()).nullable(),
    shortName: z.array(z.string().nullable()).nullable(),
    tag: z.array(z.string().nullable()).nullable(),
    tier: z.array(z.number().nullable()).nullable(),
    nation: z.array(z.string().nullable()).nullable(),
    type: z.array(z.string().nullable()).nullable(),
    role: z.array(z.string().nullable()).nullable(),
    isPremium: z.array(z.boolean().nullable()).nullable(),
    isReward: z.array(z.boolean().nullable()).nullable(),
    owned: z.array(z.boolean().nullable()).nullable().meta({
      description:
        "Whether the account still holds each vehicle. Null for a vehicle means nobody has verified that garage: Wargaming answers `in_garage` null for every caller but the account itself, so a vehicle sold years ago is indistinguishable from one still owned. Only a player who has signed in with Wargaming.net ID can turn this into real booleans, and when they have, a false entry is a vehicle they no longer have. The whole column is null on an unverified garage.",
    }),
    mom: z.array(z.number().nullable()).nullable(),
    moe: z.array(z.number().nullable()).nullable(),
    moePercent: z.array(z.number().nullable()).nullable().meta({
      description:
        "Progress towards the next mark of excellence, 0-100 with two decimals. Only ever known for an account running the mod: the value lives in the client's own vehicle dossier and is in neither the public API nor the portal. The whole column is null when nobody has reported it.",
    }),
    battles: z.array(z.number().nullable()).nullable(),
    avgDamage: z.array(z.number().nullable()).nullable(),
    avgXp: z.array(z.number().nullable()).nullable(),
    winrate: z.array(z.number().nullable()).nullable(),
    wn7: z.array(z.number().nullable()).nullable(),
    wn8: z.array(z.number().nullable()).nullable(),
    wnx: z.array(z.number().nullable()).nullable(),
    buyGold: z.array(z.number().nullable()).nullable(),
    buyCredits: z.array(z.number().nullable()).nullable(),
    researchXp: z.array(z.number().nullable()).nullable(),
    markReach: markReachColumns,
    career: careerColumns,
  })
  .meta({
    id: "PlayerVehicleColumns",
    description:
      "The player's vehicles, one array per field. Normally the tanks they have battles in, which is all Wargaming publishes about a stranger. On an account whose owner has signed in here, the list is their actual garage instead: vehicles they have sold are marked `owned: false`, and vehicles they own but have never driven appear with zero battles and null averages.",
  });

/**
 * `wn7`, `wn8` and `wnx` on every vehicle are null when `mode` is anything but
 * `random`: all three are built against expected values measured on random
 * battles, so elsewhere they score a format against a standard it was never set
 * by. The site's own table drops the column rather than dashing it.
 */
export const PlayerTanksResponse = z.object({
  tanks: playerVehicleColumns,
  mode: battleMode.nullable().meta({
    description:
      "The mode the rows describe, or null for the vehicle's whole record.",
  }),
  window: z
    .object({
      window: z.object({
        unit: z.enum(StatWindowUnit).meta({
          description: "What the window counts: days from now, or the player's last battles.",
          "x-enum-source": "STAT_WINDOW_UNIT",
        } as EnumMeta),
        value: z.number().int(),
      }),
      from: z.coerce.date().nullable().meta({
        description:
          "The instant the window was read back from. A battle window starts at the latest snapshot that sat at least that many battles back, so it can hold a few more than asked.",
      }),
      truncated: z.boolean().meta({
        description:
          "The window reaches further back than our history of the account, so it covers everything since the account was first tracked (`from`).",
      }),
    })
    .nullable()
    .meta({
      description:
        "The window the rows were read over, or null for the vehicles' whole records. Set, each row holds only what was played inside it and only the vehicles played inside it are listed.",
    }),
  modes: z.array(playerTankModeOption).meta({
    description:
      "Every mode this player has a record in, in mode order. Empty for a player whose vehicles predate the breakdown being collected, which fills in on their next refresh: Wargaming reports lifetime totals, so there is nothing historical to backfill.",
  }),
});
