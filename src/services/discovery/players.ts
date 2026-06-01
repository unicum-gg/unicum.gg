import { db } from "@/services/db";
import { players } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";

const EPOCH = new Date(0);
const CHUNK_SIZE = 500;

export type PlayerDiscoveryEntry = {
  accountId: number;
  nickname?: string;
};

/**
 * Insert unknown players into the `players` table so the snapshot cron picks them up.
 * Already-known players are not touched.
 */
export async function discoverPlayers(
  region: Region,
  entries: PlayerDiscoveryEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const unique = new Map<number, string>();
  for (const e of entries) {
    if (!unique.has(e.accountId)) unique.set(e.accountId, e.nickname ?? "");
  }

  const rows = Array.from(unique).map(([accountId, nickname]) => ({
    region,
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
