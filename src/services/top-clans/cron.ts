import { eq } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { topClans } from "@/services/db/schema";
import { REGIONS } from "@/services/wargaming/wot";
import { computeTopClansByWnx } from "@/services/wargaming/wot/clans/top";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;

export function startTopClansCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await refreshAllRegions();
    } catch (err) {
      console.error("[top-clans cron] tick failed:", err);
    }
  });
  console.log(`[top-clans cron] scheduled (${SCHEDULE})`);

  void runInitialIfEmpty();
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    const existing = await db.select({ rank: topClans.rank }).from(topClans).limit(1);
    if (existing.length > 0) return;

    console.log("[top-clans cron] empty table, running initial refresh");
    await refreshAllRegions();
  } catch (err) {
    console.error("[top-clans cron] initial refresh failed:", err);
  }
}

async function refreshAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      const start = Date.now();
      const results = await computeTopClansByWnx(region, TOP_N);
      await db.transaction(async (tx) => {
        await tx.delete(topClans).where(eq(topClans.region, region));
        if (results.length > 0) {
          await tx.insert(topClans).values(
            results.map((r, i) => ({
              region,
              rank: i + 1,
              clanId: r.clan_id,
              tag: r.tag,
              name: r.name,
              color: r.color,
              emblem: r.emblem,
              membersCount: r.members_count,
              ratedMembersCount: r.rated_members_count,
              avgWnx: r.avg_wnx.toString(),
            })),
          );
        }
      });
      console.log(
        `[top-clans cron] ${region}: ${results.length} clans in ${
          Date.now() - start
        }ms`,
      );
    } catch (err) {
      console.error(`[top-clans cron] ${region} failed:`, err);
    }
  }
}
