import { sql } from "drizzle-orm";
import { db } from "@/services/db";
import { players } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import {
  getClansMembers,
  listTopClansByMembers,
} from "@/services/wargaming/wot/clans/listings";

const DB_CHUNK_SIZE = 500;
const EPOCH = new Date(0);

export type DiscoveryResult = {
  region: Region;
  clansChecked: number;
  playersDiscovered: number;
  playersUpserted: number;
};

export async function discoverTopClanPlayers(
  region: Region,
  topN: number,
): Promise<DiscoveryResult> {
  console.log(`[discovery] ${region}: listing top ${topN} clans`);
  const clanIds = await listTopClansByMembers(region, topN);
  console.log(
    `[discovery] ${region}: ${clanIds.length} clans found, fetching members`,
  );

  const clanMembers = await getClansMembers(region, clanIds);
  const playersMap = new Map<number, string>();
  for (const members of clanMembers.values()) {
    for (const m of members) {
      playersMap.set(m.account_id, m.account_name);
    }
  }
  console.log(
    `[discovery] ${region}: ${playersMap.size} unique players to upsert`,
  );

  let upserted = 0;
  if (playersMap.size > 0) {
    const rows = Array.from(playersMap).map(([accountId, nickname]) => ({
      region,
      accountId,
      nickname,
      lastSeenAt: EPOCH,
    }));

    for (let i = 0; i < rows.length; i += DB_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + DB_CHUNK_SIZE);
      const result = await db
        .insert(players)
        .values(chunk)
        .onConflictDoUpdate({
          target: [players.region, players.accountId],
          set: { nickname: sql`excluded.nickname` },
        })
        .returning({ id: players.id });
      upserted += result.length;
    }
  }

  console.log(
    `[discovery] ${region}: done — ${upserted} players upserted from ${clanIds.length} clans`,
  );
  return {
    region,
    clansChecked: clanIds.length,
    playersDiscovered: playersMap.size,
    playersUpserted: upserted,
  };
}
