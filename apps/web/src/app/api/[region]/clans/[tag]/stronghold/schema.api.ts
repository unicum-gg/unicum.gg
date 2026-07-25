// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

const n = () => z.number().nullable();

const clanStrongholdStats = z
  .object({
    eloT6: n(),
    skirmishBattlesT6: n(),
    skirmishWinsT6: n(),
    eloT8: n(),
    skirmishBattlesT8: n(),
    skirmishWinsT8: n(),
    eloT10: n(),
    skirmishBattlesT10: n(),
    skirmishWinsT10: n(),
    advancesBattlesT10: n(),
    advancesWinsT10: n(),
  })
  .meta({
    id: "ClanStrongholdStats",
    description:
      "A clan's Stronghold Elo and skirmish/advances battles and wins per tier (6/8/10).",
  });

/** Response of `GET /{region}/clans/{tag}/stronghold` (latest + period diffs). */
export const ClanStrongholdResponse = z.object({
  latest: clanStrongholdStats.nullable(),
  periods: z.object({
    h24: clanStrongholdStats.nullable(),
    d7: clanStrongholdStats.nullable(),
    d30: clanStrongholdStats.nullable(),
  }),
  // Current (overall) Skirmish Rating per mode/tier, from the materialized
  // leaderboard. Null (or a null tier) when the clan isn't ranked.
  sr: z
    .object({ advances: n(), t10: n(), t8: n(), t6: n() })
    .nullable(),
});
