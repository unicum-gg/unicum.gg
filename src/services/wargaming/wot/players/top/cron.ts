import { eq } from "drizzle-orm";
import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { topPlayersByRegion } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import { computeTopPlayersByWnx, TopPlayersPeriod } from ".";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;
const PERIODS: TopPlayersPeriod[] = [
  TopPlayersPeriod.Day,
  TopPlayersPeriod.Week,
  TopPlayersPeriod.Overall,
];

export function startTopPlayersCron(): void {
  scheduleCron("top-players cron", SCHEDULE, async () => {
    await refreshAll();
  });
  console.log(`[top-players cron] scheduled (${SCHEDULE})`);

  void runInitialIfEmpty();
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = topPlayersByRegion[region];
      const existing = await db
        .select({ rank: table.rank })
        .from(table)
        .limit(1);
      if (existing.length === 0) {
        console.log(`[top-players cron] ${region} empty, running initial refresh`);
        await refreshRegion(region);
      }
    }
  } catch (err) {
    console.error("[top-players cron] initial refresh failed:", err);
  }
}

async function refreshAll(): Promise<void> {
  for (const region of REGIONS) {
    await refreshRegion(region);
  }
}

async function refreshRegion(region: Region): Promise<void> {
  const table = topPlayersByRegion[region];
  for (const period of PERIODS) {
    try {
      const start = Date.now();
      const results = await computeTopPlayersByWnx(region, period, TOP_N);
      await db.transaction(async (tx) => {
        await tx.delete(table).where(eq(table.period, period));
        if (results.length > 0) {
          await tx.insert(table).values(
            results.map((r, i) => ({
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
