// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankIdentity } from "./identity.api";

const tankServerStats = z
  .object({
    players: z.number(),
    avg_battles: z.number(),
    total_battles: z.number().nullable(),
    avg_damage: z.number(),
    winrate: z.number(),
    player_wr: z.number().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    avg_spots: z.number().nullable(),
    avg_assist: z.number().nullable(),
    kdr: z.number().nullable(),
    hit_pct: z.number().nullable(),
    pen_pct: z.number().nullable(),
    avg_blocked: z.number().nullable(),
    survival: z.number().nullable(),
    moe1: z.number().nullable(),
    moe2: z.number().nullable(),
    moe3: z.number().nullable(),
    mom_class3: z.number().nullable(),
    mom_class2: z.number().nullable(),
    mom_class1: z.number().nullable(),
    mom_ace: z.number().nullable(),
  })
  .meta({
    id: "TankServerStats",
    description:
      "Server-wide performance for a tank, averaged over tracked players. moeN/momN are holder counts among tracked players; null until the by-tank cron has coverage.",
  });

/** Response of `GET /{region}/tanks` (per-tank server performance). */
export const TankPerfResponse = z.object({
  results: z.array(
    z.object({ identity: tankIdentity, stats: tankServerStats.nullable() }),
  ),
});
