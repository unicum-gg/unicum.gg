import { and, eq } from "drizzle-orm";
import { db } from "@/services/db";
import { playerClanHistory } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import type {
  ClanStint,
  PlayerClanHistoryFull,
} from "@/services/wargaming/wot/clans/player";

type SerializedClanStint = Omit<ClanStint, "joinedAt" | "leftAt"> & {
  joinedAt: string;
  leftAt: string | null;
};

type SerializedClanHistory = {
  currentStint: SerializedClanStint | null;
  pastStints: SerializedClanStint[];
  totalClans: number;
  timeInClansSeconds: number;
};

function serializeStint(s: ClanStint): SerializedClanStint {
  return {
    ...s,
    joinedAt: s.joinedAt.toISOString(),
    leftAt: s.leftAt ? s.leftAt.toISOString() : null,
  };
}

function deserializeStint(s: SerializedClanStint): ClanStint {
  return {
    ...s,
    joinedAt: new Date(s.joinedAt),
    leftAt: s.leftAt ? new Date(s.leftAt) : null,
  };
}

function serialize(data: PlayerClanHistoryFull): SerializedClanHistory {
  return {
    currentStint: data.currentStint ? serializeStint(data.currentStint) : null,
    pastStints: data.pastStints.map(serializeStint),
    totalClans: data.totalClans,
    timeInClansSeconds: data.timeInClansSeconds,
  };
}

function deserialize(data: SerializedClanHistory): PlayerClanHistoryFull {
  return {
    currentStint: data.currentStint ? deserializeStint(data.currentStint) : null,
    pastStints: data.pastStints.map(deserializeStint),
    totalClans: data.totalClans,
    timeInClansSeconds: data.timeInClansSeconds,
  };
}

export type StoredPlayerClanHistory = {
  fetchedAt: Date;
  data: PlayerClanHistoryFull;
};

export async function getStoredPlayerClanHistory(
  region: Region,
  accountId: number,
): Promise<StoredPlayerClanHistory | null> {
  const [row] = await db
    .select()
    .from(playerClanHistory)
    .where(
      and(
        eq(playerClanHistory.region, region),
        eq(playerClanHistory.accountId, accountId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    fetchedAt: row.fetchedAt,
    data: deserialize(row.data as SerializedClanHistory),
  };
}

export async function storePlayerClanHistory(
  region: Region,
  accountId: number,
  data: PlayerClanHistoryFull,
): Promise<void> {
  const serialized = serialize(data);
  await db
    .insert(playerClanHistory)
    .values({
      region,
      accountId,
      data: serialized,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [playerClanHistory.region, playerClanHistory.accountId],
      set: {
        data: serialized,
        fetchedAt: new Date(),
      },
    });
}
