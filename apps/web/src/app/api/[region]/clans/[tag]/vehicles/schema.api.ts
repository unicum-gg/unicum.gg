// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the clan page parses the response with it.
import { z } from "zod";

// --- Clan vehicles (GET /api/{region}/clans/{tag}/vehicles) ---
// Per-tank stats aggregated across all clan members, computed server-side.
// All three ratings are returned so the client can switch the displayed metric
// without another request. Fields are camelCase (see clan detail rationale).

const clanVehicle = z
  .object({
    tankId: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    tier: z.number().nullable(),
    nation: z.string().nullable(),
    type: z.string().nullable(),
    isPremium: z.boolean(),
    memberCount: z.number(),
    battles: z.number(),
    avgDamage: z.number().nullable(),
    avgXp: z.number().nullable(),
    winrate: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
  })
  .loose()
  .meta({
    id: "ClanVehicle",
    description:
      "A tank the clan has played, with battle-weighted averages and WN7/WN8/WNX ratings across all members.",
  });

export const ClanVehiclesResponse = z.object({
  vehicles: z.array(clanVehicle),
});
