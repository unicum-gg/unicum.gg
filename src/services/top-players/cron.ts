import { and, eq } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { topPlayers } from "@/services/db/schema";
import { REGIONS } from "@/services/wargaming/wot";
import {
  computeTopPlayersByWnx,
  TopPlayersPeriod,
} from "@/services/wargaming/wot/players/top";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;
const PERIODS: TopPlayersPeriod[] = [
  TopPlayersPeriod.Day,
  TopPlayersPeriod.Week,
  TopPlayersPeriod.Overall,
];

export function startTopPlayersCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await refreshAll();
    } catch (err) {
      console.error("[top-players cron] tick failed:", err);
    }
  });
  console.log(`[top-players cron] scheduled (${SCHEDULE})`);

  void runInitialIfEmpty();
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    const existing = await db
      .select({ rank: topPlayers.rank })
      .from(topPlayers)
      .limit(1);
    if (existing.length > 0) return;

    console.log("[top-players cron] empty table, running initial refresh");
    await refreshAll();
  } catch (err) {
    console.error("[top-players cron] initial refresh failed:", err);
  }
}

async function refreshAll(): Promise<void> {
  for (const region of REGIONS) {
    for (const period of PERIODS) {
      try {
        const start = Date.now();
        const results = await computeTopPlayersByWnx(region, period, TOP_N);
        await db.transaction(async (tx) => {
          await tx
            .delete(topPlayers)
            .where(
              and(eq(topPlayers.region, region), eq(topPlayers.period, period)),
            );
          if (results.length > 0) {
            await tx.insert(topPlayers).values(
              results.map((r, i) => ({
                region,
                period,
                rank: i + 1,
                accountId: r.account_id,
                nickname: r.nickname,
                clanTag: r.clan_tag,
                clanColor: r.clan_color,
                battles: r.battles,
                wnx: r.wnx.toString(),
              })),
            );
          }
        });
        console.log(
          `[top-players cron] ${region}/${period}: ${results.length} players in ${
            Date.now() - start
          }ms`,
        );
      } catch (err) {
        console.error(
          `[top-players cron] ${region}/${period} failed:`,
          err,
        );
      }
    }
  }
}
