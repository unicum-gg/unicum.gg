import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/services/db";
import { clanRefreshQueue, clans } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";

const CHUNK_SIZE = 500;

/**
 * Mark unknown clans for discovery so the refresh cron picks them up.
 * Already-known clans (present in the `clans` table) are skipped.
 */
export async function discoverClans(
  region: Region,
  clanIds: number[],
): Promise<void> {
  if (clanIds.length === 0) return;
  // Sort so concurrent inserts acquire row-level locks in the same order
  // (prevents Postgres 40P01 deadlocks).
  const unique = Array.from(new Set(clanIds)).sort((a, b) => a - b);

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const existing = await db
      .select({ id: clans.id })
      .from(clans)
      .where(and(eq(clans.region, region), inArray(clans.id, chunk)));
    const knownIds = new Set(existing.map((r) => Number(r.id)));
    const toQueue = chunk.filter((id) => !knownIds.has(id));
    if (toQueue.length === 0) continue;

    await db
      .insert(clanRefreshQueue)
      .values(toQueue.map((clanId) => ({ region, clanId, firstSeen: true })))
      .onConflictDoNothing();
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
