import { asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { clansByRegion } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import { refreshClansByIdsBatch } from "./repository";
import { refreshClanEvents } from "./repository/events";
import { refreshClanMembers } from "./repository/members";

const SCHEDULE = "* * * * *";
const BATCH_SIZE_PER_REGION = 20;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 250;

export function startClanBackfillCron(): void {
  scheduleCron("clan-backfill-cron", SCHEDULE, async () => {
    await refreshDueClans();
  });
  console.log(`[clan-backfill-cron] stale scan scheduled (${SCHEDULE})`);
}

export type ClanBackfillResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

async function pickStaleForRegion(
  region: Region,
  cutoff: Date,
  limit: number,
): Promise<{ clanIds: number[]; staleCount: number }> {
  const clans = clansByRegion[region];
  const where = or(
    isNull(clans.lastRefreshedAt),
    lt(clans.lastRefreshedAt, cutoff),
  );
  const [rows, [{ staleCount }]] = await Promise.all([
    db
      .select({ id: clans.id })
      .from(clans)
      .where(where)
      .orderBy(asc(clans.lastRefreshedAt))
      .limit(limit),
    db.select({ staleCount: count() }).from(clans).where(where),
  ]);
  return {
    clanIds: rows.map((r) => Number(r.id)),
    staleCount: Number(staleCount),
  };
}

export async function refreshDueClans(): Promise<ClanBackfillResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);

  const perRegion = await Promise.all(
    REGIONS.map(async (region) => {
      const { clanIds, staleCount } = await pickStaleForRegion(
        region,
        cutoff,
        BATCH_SIZE_PER_REGION,
      );
      return { region, clanIds, staleCount };
    }),
  );

  const total = perRegion.reduce((acc, r) => acc + r.clanIds.length, 0);
  if (total === 0) return { processed: 0, succeeded: 0, failed: 0 };

  console.log(
    `[clan-backfill-cron] refreshing ${total} clans (${perRegion
      .map((r) => `${r.region}:${r.clanIds.length}/${r.staleCount}s`)
      .join(", ")})`,
  );

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    perRegion.map(async ({ region, clanIds }) => {
      if (clanIds.length === 0) return;
      const clans = clansByRegion[region];

      const infos = await refreshClansByIdsBatch(region, clanIds).catch(
        (err) => {
          console.error(
            `[clan-backfill-cron] batch info failed (${region}):`,
            err,
          );
          return new Map<number, unknown>();
        },
      );

      for (const clanId of clanIds) {
        const info = infos.get(clanId);
        if (!info) {
          failed += 1;
          // Bump lastRefreshedAt so a ghost clan goes to the back of the line
          // instead of being picked up again on the next tick.
          await db
            .update(clans)
            .set({ lastRefreshedAt: sql`NOW()` })
            .where(eq(clans.id, clanId));
          continue;
        }
        try {
          await Promise.all([
            refreshClanMembers(region, clanId).catch((err) =>
              console.error(
                `[clan-backfill-cron] members ${region}/${clanId} failed:`,
                err,
              ),
            ),
            refreshClanEvents(region, clanId, 30).catch((err) =>
              console.error(
                `[clan-backfill-cron] events ${region}/${clanId} failed:`,
                err,
              ),
            ),
          ]);
          succeeded += 1;
        } catch (err) {
          failed += 1;
          console.error(
            `[clan-backfill-cron] ${region}/${clanId} failed:`,
            err,
          );
        }
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    }),
  );

  console.log(
    `[clan-backfill-cron] done: ${succeeded} ok, ${failed} failed`,
  );
  return { processed: total, succeeded, failed };
}
