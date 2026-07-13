// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

const n = () => z.number().nullable();

const clanGlobalMapStats = z
  .object({
    gmEloT10: n(),
    gmBattlesT10: n(),
    gmWinsT10: n(),
    gmEloT8: n(),
    gmBattlesT8: n(),
    gmWinsT8: n(),
    gmEloT6: n(),
    gmBattlesT6: n(),
    gmWinsT6: n(),
    gmProvinces: n(),
  })
  .meta({
    id: "ClanGlobalMapStats",
    description:
      "A clan's Global Map (Clan Wars) Elo, battles and wins per tier (6/8/10) and its province count.",
  });

/** Response of `GET /{region}/clans/{tag}/clan-wars` (latest + period diffs). */
export const ClanWarsResponse = z.object({
  latest: clanGlobalMapStats.nullable(),
  periods: z.object({
    h24: clanGlobalMapStats.nullable(),
    d7: clanGlobalMapStats.nullable(),
    d30: clanGlobalMapStats.nullable(),
  }),
});
