import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type ClanSnapshot,
  clanSnapshotsByRegion,
} from "@/services/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";
import type { ClanGlobalMapData } from "@/services/wargaming/wot/clans/globalmap";
import type { ClanStrongholdData } from "@/services/wargaming/wot/clans/stronghold";
import type { ClanSnapshotPeriods } from "./snapshot-stats";

const SNAPSHOT_THROTTLE_MS = 24 * 60 * 60 * 1000;

export async function recordClanSnapshot(
  region: Region,
  clanId: number,
  data: ClanStrongholdData,
  gm: ClanGlobalMapData | null = null,
): Promise<void> {
  const snapshots = clanSnapshotsByRegion[region];

  const [latest] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.clanId, clanId))
    .orderBy(desc(snapshots.takenAt))
    .limit(1);

  if (latest && Date.now() - latest.takenAt.getTime() < SNAPSHOT_THROTTLE_MS) {
    return;
  }

  await db.insert(snapshots).values({
    clanId,
    eloT6: data.t6?.elo ?? null,
    skirmishBattlesT6: data.t6?.skirmishBattles ?? null,
    skirmishWinsT6: data.t6?.skirmishWins ?? null,
    eloT8: data.t8?.elo ?? null,
    skirmishBattlesT8: data.t8?.skirmishBattles ?? null,
    skirmishWinsT8: data.t8?.skirmishWins ?? null,
    eloT10: data.t10?.elo ?? null,
    skirmishBattlesT10: data.t10?.skirmishBattles ?? null,
    skirmishWinsT10: data.t10?.skirmishWins ?? null,
    advancesBattlesT10: data.t10?.advancesBattles ?? null,
    advancesWinsT10: data.t10?.advancesWins ?? null,
    gmEloT10: gm?.eloT10 ?? null,
    gmBattlesT10: gm?.battlesT10 ?? null,
    gmWinsT10: gm?.winsT10 ?? null,
    gmEloT8: gm?.eloT8 ?? null,
    gmBattlesT8: gm?.battlesT8 ?? null,
    gmWinsT8: gm?.winsT8 ?? null,
    gmEloT6: gm?.eloT6 ?? null,
    gmBattlesT6: gm?.battlesT6 ?? null,
    gmWinsT6: gm?.winsT6 ?? null,
    gmProvinces: gm?.provinces ?? null,
  });
}

export async function getClanSnapshotPeriods(
  region: Region,
  clanId: number,
): Promise<ClanSnapshotPeriods> {
  const snapshots = clanSnapshotsByRegion[region];
  const now = Date.now();
  const cutoffs = {
    h24: new Date(now - 24 * 60 * 60 * 1000),
    d7: new Date(now - 7 * 24 * 60 * 60 * 1000),
    d30: new Date(now - 30 * 24 * 60 * 60 * 1000),
  };

  async function latestBefore(cutoff: Date): Promise<ClanSnapshot | null> {
    const [row] = await db
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.clanId, clanId),
          lte(snapshots.takenAt, cutoff),
        ),
      )
      .orderBy(desc(snapshots.takenAt))
      .limit(1);
    return row ?? null;
  }

  const [h24, d7, d30] = await Promise.all([
    latestBefore(cutoffs.h24),
    latestBefore(cutoffs.d7),
    latestBefore(cutoffs.d30),
  ]);

  return { h24, d7, d30 };
}

export async function getLatestClanSnapshot(
  region: Region,
  clanId: number,
): Promise<ClanSnapshot | null> {
  const snapshots = clanSnapshotsByRegion[region];
  const [row] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.clanId, clanId))
    .orderBy(desc(snapshots.takenAt))
    .limit(1);
  return row ?? null;
}
