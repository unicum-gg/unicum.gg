import { asc, desc, eq } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { clanRefreshQueue } from "@/services/db/schema";
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

export function startClanRefreshCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await drainClanRefreshQueue();
    } catch (err) {
      console.error("[clan-refresh-cron] tick failed:", err);
    }
  });
  console.log(`[clan-refresh-cron] queue drain scheduled (${SCHEDULE})`);
}

async function pickEntriesForRegion(
  region: Region,
  limit: number,
): Promise<number[]> {
  const rows = await db
    .select({ clanId: clanRefreshQueue.clanId })
    .from(clanRefreshQueue)
    .where(eq(clanRefreshQueue.region, region))
    .orderBy(
      desc(clanRefreshQueue.priority),
      asc(clanRefreshQueue.queuedAt),
    )
    .limit(limit);
  return rows.map((r) => Number(r.clanId));
}

export async function drainClanRefreshQueue(): Promise<void> {
  const perRegion = await Promise.all(
    REGIONS.map(async (region) => ({
      region,
      clanIds: await pickEntriesForRegion(region, BATCH_SIZE_PER_REGION),
    })),
  );
  const total = perRegion.reduce((a, r) => a + r.clanIds.length, 0);
  if (total === 0) return;

  let ok = 0;
  let failed = 0;

  await Promise.all(
    perRegion.map(async ({ region, clanIds }) => {
      if (clanIds.length === 0) return;

      // 1. Batched info upsert — single WG roundtrip + publish per clan.
      const infos = await refreshClansByIdsBatch(region, clanIds).catch(
        (err) => {
          console.error(
            `[clan-refresh-cron] batch info failed (${region}):`,
            err,
          );
          return new Map<number, unknown>();
        },
      );

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
                `[clan-refresh-cron] members ${region}/${clanId} failed:`,
                err,
              ),
            ),
            refreshClanEvents(region, clanId, 30).catch((err) =>
              console.error(
                `[clan-refresh-cron] events ${region}/${clanId} failed:`,
                err,
              ),
            ),
          ]);
          ok += 1;
        } catch (err) {
          failed += 1;
          console.error(
            `[clan-refresh-cron] ${region}/${clanId} failed:`,
            err,
          );
        }
        await dequeueClanRefresh(region, clanId);
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    }),
  );

  console.log(
    `[clan-refresh-cron] drained ${total} (${ok} ok, ${failed} failed)`,
  );
}
