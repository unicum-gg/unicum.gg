import { asc, desc } from "drizzle-orm";
import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { clanRefreshQueueByRegion } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import { dequeueClanRefresh } from "./refresh-queue";
import { refreshClansByIdsBatch } from "./repository";
import { refreshClanEvents } from "./repository/events";
import { refreshClanMembers } from "./repository/members";

// 10s tick — fast enough for user-initiated page visits to feel live, loose
// enough to coalesce bursts on the same clan into a single drain.
const SCHEDULE = "*/10 * * * * *";
const BATCH_SIZE_PER_REGION = 5;
// Members + events are per-clan portal calls; throttle between them so we
// don't trip Wargaming's portal rate limit on a busy queue.
const REQUEST_DELAY_MS = 250;

/**
 * Schedules one independent cron per region so a backed-up region (G-Core
 * throttling on EU portal calls) can't starve the others.
 */
export function startClanRefreshCron(): void {
  for (const region of REGIONS) {
    const name = `clan-refresh-cron-${region}`;
    if (
      scheduleCron(name, SCHEDULE, async () => {
        await drainClanRefreshQueueForRegion(region);
      })
    ) {
      console.log(`[${name}] queue drain scheduled (${SCHEDULE})`);
    }
  }
}

async function pickEntriesForRegion(
  region: Region,
  limit: number,
): Promise<number[]> {
  const queue = clanRefreshQueueByRegion[region];
  const rows = await db
    .select({ clanId: queue.clanId })
    .from(queue)
    .orderBy(desc(queue.priority), asc(queue.queuedAt))
    .limit(limit);
  return rows.map((r) => Number(r.clanId));
}

export async function drainClanRefreshQueueForRegion(
  region: Region,
): Promise<void> {
  const clanIds = await pickEntriesForRegion(region, BATCH_SIZE_PER_REGION);
  if (clanIds.length === 0) return;

  let ok = 0;
  let failed = 0;

  // 1. Batched info upsert — single WG roundtrip + publish per clan.
  const infos = await refreshClansByIdsBatch(region, clanIds).catch((err) => {
    console.error(`[clan-refresh-cron-${region}] batch info failed:`, err);
    return new Map<number, unknown>();
  });

  // 2. Members + events per-clan (portal, rate-limited).
  for (const clanId of clanIds) {
    const info = infos.get(clanId);
    if (!info) {
      // Ghost clan or batch failure — drop from queue so we don't loop.
      failed += 1;
      await dequeueClanRefresh(region, clanId);
      continue;
    }
    try {
      await Promise.all([
        refreshClanMembers(region, clanId).catch((err) =>
          console.error(
            `[clan-refresh-cron-${region}] members ${clanId} failed:`,
            err,
          ),
        ),
        refreshClanEvents(region, clanId, 30).catch((err) =>
          console.error(
            `[clan-refresh-cron-${region}] events ${clanId} failed:`,
            err,
          ),
        ),
      ]);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`[clan-refresh-cron-${region}] ${clanId} failed:`, err);
    }
    await dequeueClanRefresh(region, clanId);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log(
    `[clan-refresh-cron-${region}] drained ${clanIds.length} (${ok} ok, ${failed} failed)`,
  );
}
