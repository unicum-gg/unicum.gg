// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the player page parses the response with it. Reuses the
// per-tank row schema defined in the player detail route (they are the same
// rows, just moved to their own endpoint for on-demand loading).
import { z } from "zod";
import { TankBattleMode } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { playerVehicle } from "../schema.api";

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
 * `wn7`, `wn8` and `wnx` on every row are null when `mode` is anything but
 * `random`: all three are built against expected values measured on random
 * battles, so elsewhere they score a format against a standard it was never set
 * by. The site's own table drops the column rather than dashing it.
 */
export const PlayerTanksResponse = z.object({
  tanks: z.array(playerVehicle),
  mode: battleMode.nullable().meta({
    description:
      "The mode the rows describe, or null for the vehicle's whole record.",
  }),
  modes: z.array(playerTankModeOption).meta({
    description:
      "Every mode this player has a record in, in mode order. Empty for a player whose vehicles predate the breakdown being collected, which fills in on their next refresh: Wargaming reports lifetime totals, so there is nothing historical to backfill.",
  }),
});
