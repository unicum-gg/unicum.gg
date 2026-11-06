import { and, asc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  battleSquads,
  battlesByRegion,
  readReplayHeader,
  type BattleVehicle,
  type SquadResults,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { fetchReplay } from "@unicum.gg/core/battles/replays";

/**
 * Give the battles recorded before the mod sent platoons their platoons back,
 * from the replay we hold of each.
 *
 * Only a battle with a stored replay can be recovered: the platoons are read
 * off the results the file carries (`players[].prebattleID` and the battle's
 * GUI type), which is the one place they survive. Every other battle stays
 * without, which reads as "no platoons" and is the honest answer.
 *
 * Idempotent: a battle whose vehicles already carry a platoon is skipped, and
 * a battle the file says had none is rewritten to nothing at all.
 */
export type SquadBackfillStats = {
  read: number;
  marked: number;
  none: number;
  unreadable: number;
};

const BATCH = 50;

/** The battle's results out of a replay's header blocks, or null. */
function resultsIn(blocks: unknown[]): SquadResults | null {
  for (const block of blocks.slice(1)) {
    const candidate = Array.isArray(block) ? block[0] : block;
    if (
      candidate &&
      typeof candidate === "object" &&
      "players" in candidate &&
      "common" in candidate
    ) {
      return candidate as SquadResults;
    }
  }
  return null;
}

export async function backfillBattleSquads(
  region: Region,
  log: (line: string) => void = () => {},
): Promise<SquadBackfillStats> {
  const table = battlesByRegion[region];
  const stats: SquadBackfillStats = { read: 0, marked: 0, none: 0, unreadable: 0 };
  let after: { startedAt: Date; id: string } | null = null;

  for (;;) {
    const rows: {
      arenaUniqueId: string;
      startedAt: Date;
      replayKey: string | null;
      vehicles: BattleVehicle[];
    }[] = await db
      .select({
        arenaUniqueId: table.arenaUniqueId,
        startedAt: table.startedAt,
        replayKey: table.replayKey,
        vehicles: table.vehicles,
      })
      .from(table)
      .where(
        and(
          isNotNull(table.replayKey),
          sql`NOT jsonb_path_exists(${table.vehicles}, '$[*].squad')`,
          after
            ? or(
                gt(table.startedAt, after.startedAt),
                and(
                  eq(table.startedAt, after.startedAt),
                  gt(table.arenaUniqueId, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(table.startedAt), asc(table.arenaUniqueId))
      .limit(BATCH);
    if (rows.length === 0) break;

    for (const row of rows) {
      stats.read += 1;
      const file = row.replayKey ? await fetchReplay(row.replayKey) : null;
      let results: SquadResults | null = null;
      if (file) {
        try {
          results = resultsIn(readReplayHeader(file).blocks);
        } catch {
          results = null;
        }
      }
      if (!results) {
        stats.unreadable += 1;
        continue;
      }
      const squads = battleSquads(results);
      if (squads.size === 0) {
        stats.none += 1;
        continue;
      }
      const vehicles = row.vehicles.map((vehicle) => {
        const squad = squads.get(vehicle.id);
        return squad ? { ...vehicle, squad } : vehicle;
      });
      await db
        .update(table)
        .set({ vehicles })
        .where(
          and(
            eq(table.startedAt, row.startedAt),
            eq(table.arenaUniqueId, row.arenaUniqueId),
          ),
        );
      stats.marked += 1;
    }
    const last = rows[rows.length - 1];
    after = { startedAt: last.startedAt, id: last.arenaUniqueId };
    log(
      `${stats.read} read, ${stats.marked} with platoons, ${stats.none} without, ` +
        `${stats.unreadable} unreadable`,
    );
  }
  return stats;
}
