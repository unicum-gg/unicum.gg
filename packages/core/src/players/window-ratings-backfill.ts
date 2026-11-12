import { and, asc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import { TOP_PLAYERS_MIN_BATTLES, buildWN8Fallback, playersByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import type { Region } from "@unicum.gg/wargaming";
import { getLatestTankSnapshotsByAccounts, tankSnapshotsToTankStats } from "./tanks";
import {
  type RatingContext,
  computeWindowRatings,
  playerWindowColumns,
  writeTierWindowRatings,
} from "./window-ratings";

const BATCH = 200;
const CONCURRENCY = 6;

export type TierWindowBackfillResult = {
  cursor: number;
  examined: number;
  written: number;
};

/**
 * Seed `*_player_tier_window_ratings` for every account a recent board could
 * rank today, and the window columns on its player row, from the snapshots we
 * already hold.
 *
 * The snapshot path writes the table on each account's next battle, which is
 * soon for most of them, but the 30-day board also ranks players who last
 * played three weeks ago and will not be written until they play again. This
 * computes exactly what that path would, with each vehicle's newest stored
 * snapshot standing in for the live figures it would have fetched.
 *
 * Candidates are the accounts whose ALL-tier window already clears a floor,
 * since a tier floor can only remove battles from it. With `staleBefore`, they
 * are instead every account that played in the last 30 days but not since that
 * instant: the ones still carrying figures a change to the window computation
 * has made wrong, which the snapshot path will not rewrite until they play
 * again. Resumable on the players id, like the other backfills.
 */
export async function backfillTierWindowRatings(
  region: Region,
  {
    from = 0,
    limit,
    staleBefore,
    onProgress,
  }: {
    from?: number;
    limit?: number;
    staleBefore?: Date;
    onProgress?: (r: TierWindowBackfillResult) => void;
  } = {},
): Promise<TierWindowBackfillResult> {
  const players = playersByRegion[region];
  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);
  const ctx: RatingContext = {
    encyclopedia,
    wn8Expected,
    wnxExpected,
    wn8Fallback: buildWN8Fallback(wn8Expected, encyclopedia),
  };

  const result: TierWindowBackfillResult = { cursor: from, examined: 0, written: 0 };
  for (;;) {
    const remaining = limit === undefined ? BATCH : Math.min(BATCH, limit - result.examined);
    if (remaining <= 0) break;
    const batch = await db
      .select({
        id: players.id,
        accountId: players.accountId,
        lastBattleAt: players.lastBattleAt,
      })
      .from(players)
      .where(
        and(
          gt(players.id, result.cursor),
          isNull(players.softDeletedAt),
          gte(players.lastBattleAt, sql`now() - interval '30 days'`),
          staleBefore
            ? lt(players.lastBattleAt, staleBefore)
            : or(
                gte(players.battles30d, TOP_PLAYERS_MIN_BATTLES[TopPlayersPeriod.Month]),
                gte(players.battles7d, TOP_PLAYERS_MIN_BATTLES[TopPlayersPeriod.Week]),
                gte(players.battles24h, TOP_PLAYERS_MIN_BATTLES[TopPlayersPeriod.Day]),
              ),
        ),
      )
      .orderBy(asc(players.id))
      .limit(remaining);
    if (batch.length === 0) break;

    const latest = await getLatestTankSnapshotsByAccounts(
      region,
      batch.map((p) => Number(p.accountId)),
    );
    const queue = [...batch];
    const work = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const snapshots = latest.get(Number(p.accountId));
        if (!snapshots || snapshots.length === 0) continue;
        const windows = await computeWindowRatings(
          region,
          p.id,
          tankSnapshotsToTankStats(snapshots),
          ctx,
        );
        await writeTierWindowRatings(region, Number(p.accountId), windows);
        // Only while the row is still the one read: an account that played
        // since has been rewritten by the snapshot path from fresher figures.
        if (p.lastBattleAt) {
          await db
            .update(players)
            .set(playerWindowColumns(windows))
            .where(and(eq(players.id, p.id), eq(players.lastBattleAt, p.lastBattleAt)));
        }
        result.written += 1;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, work));

    result.examined += batch.length;
    result.cursor = batch[batch.length - 1].id;
    onProgress?.(result);
  }
  return result;
}
