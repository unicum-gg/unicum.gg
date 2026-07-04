import { inArray } from "drizzle-orm";
import { enqueueClanRefresh } from "@unicum.gg/core/clans/refresh-queue";
import { db } from "@unicum.gg/core/db";
import { clansByRegion } from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

const CHUNK_SIZE = 500;

/**
 * Mark unknown clans for discovery so the refresh cron picks them up.
 * Already-known clans (present in the regional clans table) are skipped.
 * Enqueued at priority 0 — user-initiated page hits sit above at priority 10.
 */
export async function discoverClans(
  region: Region,
  clanIds: number[],
): Promise<void> {
  if (clanIds.length === 0) return;
  const clans = clansByRegion[region];
  const unique = Array.from(new Set(clanIds));

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const existing = await db
      .select({ id: clans.id })
      .from(clans)
      .where(inArray(clans.id, chunk));
    const knownIds = new Set(existing.map((r) => Number(r.id)));
    const toQueue = chunk.filter((id) => !knownIds.has(id));
    if (toQueue.length === 0) continue;

    await enqueueClanRefresh(region, toQueue, { priority: 0 });
  }
}

/**
 * Fire-and-forget variant for use in hot paths.
 */
export function discoverClansBackground(
  region: Region,
  clanIds: number[],
): void {
  void discoverClans(region, clanIds).catch((err) =>
    console.error(`[discovery] discoverClans ${region} failed:`, err),
  );
}
