import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { topClansByRegion } from "@/services/db/schema";
import { REGIONS } from "@/services/wargaming/wot";
import { computeTopClansByWnx } from ".";

const SCHEDULE = "0 * * * *";
const TOP_N = 30;

export function startTopClansCron(): void {
  if (
    scheduleCron("top-clans cron", SCHEDULE, async () => {
      await refreshAllRegions();
    })
  ) {
    console.log(`[top-clans cron] scheduled (${SCHEDULE})`);
    void runInitialIfEmpty();
  }
}

async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = topClansByRegion[region];
      const existing = await db.select({ rank: table.rank }).from(table).limit(1);
      if (existing.length === 0) {
        console.log(`[top-clans cron] ${region} empty, running initial refresh`);
        await refreshRegion(region);
      }
    }
  } catch (err) {
    console.error("[top-clans cron] initial refresh failed:", err);
  }
}

async function refreshAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      await refreshRegion(region);
    } catch (err) {
      console.error(`[top-clans cron] ${region} failed:`, err);
    }
  }
}

async function refreshRegion(region: (typeof REGIONS)[number]): Promise<void> {
  const table = topClansByRegion[region];
  const start = Date.now();
  const results = await computeTopClansByWnx(region, TOP_N);
  await db.transaction(async (tx) => {
    await tx.delete(table);
    if (results.length > 0) {
      await tx.insert(table).values(
        results.map((r, i) => ({
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
}
