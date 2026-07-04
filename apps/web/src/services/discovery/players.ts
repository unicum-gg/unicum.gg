import { db } from "@/services/db";
import { playersByRegion } from "@/services/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

const EPOCH = new Date(0);
const CHUNK_SIZE = 500;

export type PlayerDiscoveryEntry = {
  accountId: number;
  nickname?: string;
};

/**
 * Insert unknown players into the regional players table so the snapshot
 * cron picks them up. Already-known players are not touched.
 */
export async function discoverPlayers(
  region: Region,
  entries: PlayerDiscoveryEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const players = playersByRegion[region];

  const unique = new Map<number, string>();
  for (const e of entries) {
    if (!unique.has(e.accountId)) unique.set(e.accountId, e.nickname ?? "");
  }

  // Sort by accountId so concurrent bulk inserts acquire row-level locks in
  // the same order. Without this we get Postgres deadlocks (40P01) when two
  // workers (e.g. refreshClanMembers + refreshClanEvents) discover overlapping
  // players simultaneously.
  const rows = Array.from(unique)
    .sort((a, b) => a[0] - b[0])
    .map(([accountId, nickname]) => ({
      accountId,
      nickname,
      lastSeenAt: EPOCH,
    }));

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await db.insert(players).values(chunk).onConflictDoNothing();
  }
}

/**
 * Fire-and-forget variant for use in hot paths.
 */
export function discoverPlayersBackground(
  region: Region,
  entries: PlayerDiscoveryEntry[],
): void {
  void discoverPlayers(region, entries).catch((err) =>
    console.error(`[discovery] discoverPlayers ${region} failed:`, err),
  );
}
