import { asc, lt } from "drizzle-orm";
import cron from "node-cron";
import { db } from "@/services/db";
import { players } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import { getPlayerInfo } from "@/services/wargaming/wot/accounts";
import { recordCurrentSnapshot } from ".";

const SCHEDULE = "* * * * *";
const BATCH_SIZE = 10;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 100;

export function startSnapshotCron() {
  cron.schedule(SCHEDULE, () => {
    refreshDuePlayers().catch((err) => {
      console.error("[cron] tick failed:", err);
    });
  });
  console.log(`[cron] snapshot refresh scheduled (${SCHEDULE})`);
}

export type RefreshResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

export async function refreshDuePlayers(): Promise<RefreshResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);

  const due = await db
    .select()
    .from(players)
    .where(lt(players.lastSeenAt, cutoff))
    .orderBy(asc(players.lastSeenAt))
    .limit(BATCH_SIZE);

  if (due.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`[cron] refreshing ${due.length} due players`);
  let succeeded = 0;
  let failed = 0;

  for (const player of due) {
    try {
      const region = player.region as Region;
      const info = await getPlayerInfo(region, player.accountId);
      if (info) {
        await recordCurrentSnapshot(region, info);
        succeeded += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(
        `[cron] failed for ${player.nickname} (${player.region}):`,
        err,
      );
    }
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log(`[cron] done: ${succeeded} ok, ${failed} failed`);
  return { processed: due.length, succeeded, failed };
}
