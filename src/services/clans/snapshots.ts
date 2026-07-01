import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type ClanSnapshot,
  clanSnapshotsByRegion,
} from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import type { ClanStrongholdData } from "@/services/wargaming/wot/clans/stronghold";

const SNAPSHOT_THROTTLE_MS = 24 * 60 * 60 * 1000;

export type ClanStrongholdStats = {
  eloT6: number | null;
  skirmishBattlesT6: number | null;
  skirmishWinsT6: number | null;
  eloT8: number | null;
  skirmishBattlesT8: number | null;
  skirmishWinsT8: number | null;
  eloT10: number | null;
  skirmishBattlesT10: number | null;
  skirmishWinsT10: number | null;
  advancesBattlesT10: number | null;
  advancesWinsT10: number | null;
};

export type ClanSnapshotPeriods = {
  h24: ClanSnapshot | null;
  d7: ClanSnapshot | null;
  d30: ClanSnapshot | null;
};

export function strongholdStatsFromClanSnapshot(
  s: ClanSnapshot,
): ClanStrongholdStats {
  return {
    eloT6: s.eloT6,
    skirmishBattlesT6: s.skirmishBattlesT6,
    skirmishWinsT6: s.skirmishWinsT6,
    eloT8: s.eloT8,
    skirmishBattlesT8: s.skirmishBattlesT8,
    skirmishWinsT8: s.skirmishWinsT8,
    eloT10: s.eloT10,
    skirmishBattlesT10: s.skirmishBattlesT10,
    skirmishWinsT10: s.skirmishWinsT10,
    advancesBattlesT10: s.advancesBattlesT10,
    advancesWinsT10: s.advancesWinsT10,
  };
}

export function diffClanStrongholdStats(
  curr: ClanStrongholdStats,
  prev: ClanStrongholdStats,
): ClanStrongholdStats {
  function diff(a: number | null, b: number | null): number | null {
    return a !== null && b !== null ? a - b : null;
  }
  return {
    eloT6: diff(curr.eloT6, prev.eloT6),
    skirmishBattlesT6: diff(curr.skirmishBattlesT6, prev.skirmishBattlesT6),
    skirmishWinsT6: diff(curr.skirmishWinsT6, prev.skirmishWinsT6),
    eloT8: diff(curr.eloT8, prev.eloT8),
    skirmishBattlesT8: diff(curr.skirmishBattlesT8, prev.skirmishBattlesT8),
    skirmishWinsT8: diff(curr.skirmishWinsT8, prev.skirmishWinsT8),
    eloT10: diff(curr.eloT10, prev.eloT10),
    skirmishBattlesT10: diff(curr.skirmishBattlesT10, prev.skirmishBattlesT10),
    skirmishWinsT10: diff(curr.skirmishWinsT10, prev.skirmishWinsT10),
    advancesBattlesT10: diff(curr.advancesBattlesT10, prev.advancesBattlesT10),
    advancesWinsT10: diff(curr.advancesWinsT10, prev.advancesWinsT10),
  };
}

export async function recordClanSnapshot(
  region: Region,
  clanId: number,
  data: ClanStrongholdData,
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
