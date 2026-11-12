import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import { battlesByRegion, tankLoadoutsByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

// Who runs the mod, which replaced "biggest tracked clan": Wargaming caps a
// clan at 100 members, so that cell was a full clan picked at random on NA and
// Asia, and on EU one staff clan the cap does not apply to.
//
// Only the mod writes either table (`/api/game/*`, each upload proven by the
// client's own token), so an account in one of them ran it. Both are read
// because neither contains the other: the garage arrives on login, a battle
// only once one is played and sent, and on 2026-10-31 EU held 20 accounts in
// the first against 7 in the second.
//
// Its own hour rather than the payload's minute: `reported_by` has to be
// unnested across every battle partition, a table that grows with each one the
// mod sends, and a count of users moves on the order of days.
export const getModUsage = unstable_cache(
  async (region: Region): Promise<{ users: number; battles: number }> => {
    const battles = battlesByRegion[region];
    const loadouts = tankLoadoutsByRegion[region];
    const rows = await db.execute<{ users: string; battles: string }>(
      sql`SELECT
            (SELECT COUNT(*) FROM (
               SELECT unnest(${battles.reportedBy}) FROM ${battles}
               UNION
               SELECT ${loadouts.accountId} FROM ${loadouts}
             ) u)::text AS users,
            (SELECT COUNT(*) FROM ${battles})::text AS battles`,
    );
    return {
      users: Number(rows[0]?.users ?? 0),
      battles: Number(rows[0]?.battles ?? 0),
    };
  },
  ["coverage-mod-usage"],
  { revalidate: 3600, tags: ["coverage"] },
);
