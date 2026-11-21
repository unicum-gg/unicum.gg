// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the clan page parses the response with it.
import { z } from "zod";

// --- Clan vehicles (GET /api/{region}/clans/{tag}/vehicles) ---
// Per-tank stats aggregated across all clan members, computed server-side.
// All three ratings are returned so the client can switch the displayed metric
// without another request. Fields are camelCase (see clan detail rationale).

/**
 * The clan's vehicles as one array per field rather than one object per
 * vehicle.
 *
 * **Because a field name costs as much as the number beside it.** Measured on a
 * 974-vehicle clan, the row-per-vehicle form came to 338,521 octets and this
 * one to 122,593, and the figures are rounded to the precision the site
 * actually displays (averages and ratings to the unit, a win rate to two
 * decimals of a percent), which is the other half of the saving: every figure
 * here is an average over dozens of members and arrived at full double
 * precision. `clanVehicleRows` in `@unicum.gg/shared` turns it back into the
 * rows.
 *
 * Each column has one entry per vehicle, in one order, so `tankId[i]` and
 * `battles[i]` are the same vehicle. `tankId` is the one column a vehicle
 * always has, so it is what says how many there are, and every column reads
 * null for a clan with no vehicles at all.
 */
const clanVehicleColumns = z
  .object({
    tankId: z.array(z.number().nullable()).nullable(),
    name: z.array(z.string().nullable()).nullable(),
    shortName: z.array(z.string().nullable()).nullable(),
    tier: z.array(z.number().nullable()).nullable(),
    nation: z.array(z.string().nullable()).nullable(),
    type: z.array(z.string().nullable()).nullable(),
    isPremium: z.array(z.boolean().nullable()).nullable(),
    role: z.array(z.string().nullable()).nullable(),
    isReward: z.array(z.boolean().nullable()).nullable(),
    memberCount: z.array(z.number().nullable()).nullable(),
    battles: z.array(z.number().nullable()).nullable(),
    avgDamage: z.array(z.number().nullable()).nullable(),
    avgXp: z.array(z.number().nullable()).nullable(),
    winrate: z.array(z.number().nullable()).nullable(),
    wn7: z.array(z.number().nullable()).nullable(),
    wn8: z.array(z.number().nullable()).nullable(),
    wnx: z.array(z.number().nullable()).nullable(),
  })
  .meta({
    id: "ClanVehicleColumns",
    description:
      "The tanks the clan has played, one array per field, with battle-weighted averages and WN7/WN8/WNX ratings across all members.",
  });

export const ClanVehiclesResponse = z.object({
  vehicles: clanVehicleColumns,
});
