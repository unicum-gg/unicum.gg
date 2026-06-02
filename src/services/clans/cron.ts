import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { clanRefreshQueue, clans } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import { refreshClansByIdsBatch } from "./repository";
import { refreshClanEvents } from "./repository/events";
import { refreshClanMembers } from "./repository/members";

const SCHEDULE = "* * * * *"; // every minute
const BATCH_SIZE_PER_REGION = 20;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 250;

export function startClanRefreshCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await refreshDueClans();
    } catch (err) {
      console.error("[clan-cron] tick failed:", err);
    }
  });
  console.log(`[clan-cron] scheduled (${SCHEDULE})`);
}

export type ClanRefreshResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

type Job = { region: Region; clanId: number; fromQueue: boolean };

async function collectJobsForRegion(
  region: Region,
  cutoff: Date,
  limit: number,
): Promise<{ jobs: Job[]; staleCount: number; queueCount: number }> {
  const [queueRows, staleRows, [{ staleCount }], [{ queueCount }]] =
    await Promise.all([
      db
        .select({ clanId: clanRefreshQueue.clanId })
        .from(clanRefreshQueue)
        .where(eq(clanRefreshQueue.region, region))
        .orderBy(asc(clanRefreshQueue.queuedAt))
        .limit(limit),
      db
        .select({ id: clans.id })
        .from(clans)
        .where(
          and(
            eq(clans.region, region),
            or(
              isNull(clans.lastRefreshedAt),
              lt(clans.lastRefreshedAt, cutoff),
            ),
          ),
        )
        .orderBy(asc(clans.lastRefreshedAt))
        .limit(limit),
      db
        .select({ staleCount: count() })
        .from(clans)
        .where(
          and(
            eq(clans.region, region),
            or(
              isNull(clans.lastRefreshedAt),
              lt(clans.lastRefreshedAt, cutoff),
            ),
          ),
        ),
      db
        .select({ queueCount: count() })
        .from(clanRefreshQueue)
        .where(eq(clanRefreshQueue.region, region)),
    ]);

  const jobs: Job[] = [];
  const seen = new Set<number>();
  for (const r of queueRows) {
    const id = Number(r.clanId);
    if (!seen.has(id)) {
      jobs.push({ region, clanId: id, fromQueue: true });
      seen.add(id);
    }
  }
  for (const r of staleRows) {
    const id = Number(r.id);
    if (!seen.has(id)) {
      jobs.push({ region, clanId: id, fromQueue: false });
      seen.add(id);
    }
    if (jobs.length >= limit) break;
  }
  return { jobs: jobs.slice(0, limit), staleCount, queueCount };
}

export async function refreshDueClans(): Promise<ClanRefreshResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);

  const perRegion = await Promise.all(
    REGIONS.map((region) =>
      collectJobsForRegion(region, cutoff, BATCH_SIZE_PER_REGION),
    ),
  );

  const total = perRegion.reduce((acc, r) => acc + r.jobs.length, 0);
  if (total === 0) return { processed: 0, succeeded: 0, failed: 0 };

  console.log(
    `[clan-cron] refreshing ${total} clans (${REGIONS.map(
      (r, i) =>
        `${r}:${perRegion[i].jobs.length}/${perRegion[i].queueCount}q+${perRegion[i].staleCount}s`,
    ).join(", ")})`,
  );

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    perRegion.map(async ({ jobs }) => {
      if (jobs.length === 0) return;

      // 1. Batch-refresh all clan infos in one WG roundtrip
      const ids = jobs.map((j) => j.clanId);
      const infos = await refreshClansByIdsBatch(jobs[0].region, ids).catch(
        (err) => {
          console.error(
            `[clan-cron] clans batch refresh failed (${jobs[0].region}):`,
            err,
          );
          return new Map<number, unknown>();
        },
      );

      // 2. For each clan that returned info, refresh members + events.
      //    Portal endpoints are per-clan, so we run them concurrency-limited.
      const region = jobs[0].region;
      for (const job of jobs) {
        const info = infos.get(job.clanId);
        if (!info) {
          failed += 1;
          // Ghost clan (WG returned no/empty data). Drop from queue so we
          // don't retry it forever; bump stale clan timestamp so it goes to
          // the back of the line.
          if (job.fromQueue) {
            await db
              .delete(clanRefreshQueue)
              .where(
                and(
                  eq(clanRefreshQueue.region, region),
                  eq(clanRefreshQueue.clanId, job.clanId),
                ),
              );
          } else {
            await db
              .update(clans)
              .set({ lastRefreshedAt: sql`NOW()` })
              .where(
                and(eq(clans.region, region), eq(clans.id, job.clanId)),
              );
          }
          continue;
        }
        try {
          await Promise.all([
            refreshClanMembers(region, job.clanId).catch((err) =>
              console.error(
                `[clan-cron] members ${region}/${job.clanId} failed:`,
                err,
              ),
            ),
            refreshClanEvents(region, job.clanId, 30).catch((err) =>
              console.error(
                `[clan-cron] events ${region}/${job.clanId} failed:`,
                err,
              ),
            ),
          ]);
          if (job.fromQueue) {
            await db
              .delete(clanRefreshQueue)
              .where(
                and(
                  eq(clanRefreshQueue.region, region),
                  eq(clanRefreshQueue.clanId, job.clanId),
                ),
              );
          }
          succeeded += 1;
        } catch (err) {
          failed += 1;
          console.error(
            `[clan-cron] ${region}/${job.clanId} failed:`,
            err,
          );
        }
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    }),
  );

  console.log(`[clan-cron] done: ${succeeded} ok, ${failed} failed`);
  return { processed: total, succeeded, failed };
}
