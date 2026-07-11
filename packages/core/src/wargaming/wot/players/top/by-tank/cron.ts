import { RATING_METRICS, RatingMetric } from "@unicum.gg/core/constants/rating";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db, pgClient } from "@unicum.gg/core/db";
import {
  tankStatsByRegion,
  topPlayersByTankByRegion,
} from "@unicum.gg/core/db/schema";
import { getPlayerClansBatch } from "@unicum.gg/core/wargaming/wot/clans/listings";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
} from "@unicum.gg/core/wargaming/wot/ratings";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";

const SCHEDULE = "30 3 * * *"; // nightly, after the other leaderboard crons
const TOP_N = 30;
// A player needs at least this many battles ON a tank to be ranked for it.
// Filters out the long tail of one-off/rental games whose ratings are noise,
// and (applied in SQL) keeps the streamed candidate set small.
const MIN_BATTLES = 100;
const CURSOR_BATCH = 5000;

type MetricKey = "wn7" | "wn8" | "wnx";
const METRIC_KEYS: MetricKey[] = ["wn7", "wn8", "wnx"];
const METRIC_ENUM: Record<MetricKey, RatingMetric> = {
  wn7: RatingMetric.Wn7,
  wn8: RatingMetric.Wn8,
  wnx: RatingMetric.Wnx,
};

type Entry = {
  accountId: number;
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
  battles: number;
  avgDamage: number;
  winrate: number;
  value: number;
};

// Top-K per (tank, metric), kept sorted descending and capped at TOP_N.
type TankTop = Record<MetricKey, Entry[]>;

function offer(list: Entry[], entry: Entry): void {
  if (list.length >= TOP_N && entry.value <= list[list.length - 1].value) return;
  // Insertion sort into the (short) capped list.
  let i = list.length;
  while (i > 0 && list[i - 1].value < entry.value) i--;
  list.splice(i, 0, entry);
  if (list.length > TOP_N) list.pop();
}

export function startTopPlayersByTankCron(): void {
  if (
    scheduleCron("top-players-by-tank cron", SCHEDULE, async () => {
      for (const region of REGIONS) {
        try {
          await recomputeTopPlayersByTank(region);
        } catch (err) {
          console.error(`[top-players-by-tank cron] ${region} failed:`, err);
        }
      }
    })
  ) {
    console.log(`[top-players-by-tank cron] scheduled (${SCHEDULE})`);
  }
}

/**
 * Recompute the per-tank leaderboard for one region (all metrics). Streams the
 * latest snapshot per (player, tank) with >= MIN_BATTLES via a server-side
 * cursor so the multi-million-row scan never buffers in memory, computes each
 * player's single-tank WN7/WN8/WNX, and keeps only the top TOP_N per
 * (tank, metric). Exported so a one-off seed can trigger it directly. Returns
 * the number of tanks that ended up with at least one ranked player.
 */
export async function recomputeTopPlayersByTank(
  region: Region,
): Promise<number> {
  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);

  const byTank = new Map<number, TankTop>();

  // Server-wide running totals per tank (all qualifying players), for the
  // "average player on this tank" panel. Accumulated in the same pass.
  type TankAgg = {
    players: number;
    battles: number;
    wins: number;
    damage: number;
    spotted: number;
    frags: number;
    droppedCap: number;
    assist: number;
    // Player WR: mean of qualifying drivers' account win rate (drivers whose
    // players row has a winrate; 0-1 fractions summed here).
    playerWrSum: number;
    playerWrCount: number;
    // Coverage-gated sums for the newer snapshot fields (null on old rows, so
    // each metric is averaged only over the players who carry it).
    survBattles: number; // battles on rows where survived_battles is present
    survived: number;
    fragsCovered: number; // frags on those same rows (KDR numerator)
    hits: number;
    shots: number;
    piercings: number;
    pierHits: number; // hits on rows where piercings is present (pen% denom)
    blocked: number;
    blockedBattles: number; // battles on rows where damage_blocked is present
    // Cumulative holder counts (>= level). MoE from marks_on_gun (portal),
    // Mastery from mark_of_mastery.
    moe1: number;
    moe2: number;
    moe3: number;
    momC3: number; // reached 3rd class or better (any mastery)
    momC2: number;
    momC1: number;
    momAce: number;
  };
  const aggByTank = new Map<number, TankAgg>();

  // Score one player's latest row for a tank into the running top-K. Only the
  // fields we need are read; `battles`/`wins`/`damage_dealt`/etc are the
  // cumulative career-on-tank numbers from that player's latest snapshot.
  const process = (row: Record<string, unknown>): void => {
    const tankId = Number(row.tank_id);
    const meta = encyclopedia[String(tankId)];
    if (!meta) return; // unknown tank (not in catalogue) -> skip
    const battles = Number(row.battles);
    if (battles < MIN_BATTLES) return;
    const wins = Number(row.wins);
    const tank: TankStats = {
      tank_id: tankId,
      mark_of_mastery: null,
      all: {
        battles,
        wins,
        damage_dealt: Number(row.damage_dealt),
        spotted: Number(row.spotted),
        frags: Number(row.frags),
        dropped_capture_points: Number(row.dropped_capture_points),
        radio_assisted_damage: Number(row.radio_assisted_damage),
        track_assisted_damage: Number(row.track_assisted_damage),
        xp: 0,
      },
    };

    const wn7 = computeWN7(
      {
        battles,
        wins,
        frags: tank.all.frags,
        damageDealt: tank.all.damage_dealt,
        spotted: tank.all.spotted,
        droppedCapturePoints: tank.all.dropped_capture_points,
      },
      meta.tier,
    );
    const wn8 = computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback);
    const wnx = computeWNX([tank], wnxExpected);

    let top = byTank.get(tankId);
    if (!top) {
      top = { wn7: [], wn8: [], wnx: [] };
      byTank.set(tankId, top);
    }
    const base = {
      accountId: Number(row.account_id),
      nickname: String(row.nickname),
      clanTag: null,
      clanColor: null,
      battles,
      avgDamage: tank.all.damage_dealt / battles,
      winrate: (wins / battles) * 100,
    };
    const scores: Record<MetricKey, number | null> = { wn7, wn8, wnx };
    for (const k of METRIC_KEYS) {
      const v = scores[k];
      if (v == null || !Number.isFinite(v)) continue;
      offer(top[k], { ...base, value: v });
    }

    let agg = aggByTank.get(tankId);
    if (!agg) {
      agg = {
        players: 0, battles: 0, wins: 0, damage: 0, spotted: 0, frags: 0,
        droppedCap: 0, assist: 0, playerWrSum: 0, playerWrCount: 0,
        survBattles: 0, survived: 0, fragsCovered: 0, hits: 0, shots: 0,
        piercings: 0, pierHits: 0, blocked: 0, blockedBattles: 0,
        moe1: 0, moe2: 0, moe3: 0, momC3: 0, momC2: 0, momC1: 0, momAce: 0,
      };
      aggByTank.set(tankId, agg);
    }
    agg.players += 1;
    agg.battles += battles;
    agg.wins += wins;
    agg.damage += tank.all.damage_dealt;
    agg.spotted += tank.all.spotted;
    agg.frags += tank.all.frags;
    agg.droppedCap += tank.all.dropped_capture_points;
    agg.assist += tank.all.radio_assisted_damage + tank.all.track_assisted_damage;

    const pwr = row.player_winrate;
    if (pwr != null) {
      agg.playerWrSum += Number(pwr);
      agg.playerWrCount += 1;
    }
    if (row.survived_battles != null) {
      agg.survBattles += battles;
      agg.survived += Number(row.survived_battles);
      agg.fragsCovered += tank.all.frags;
    }
    if (row.hits != null && row.shots != null) {
      agg.hits += Number(row.hits);
      agg.shots += Number(row.shots);
    }
    if (row.piercings != null && row.hits != null) {
      agg.piercings += Number(row.piercings);
      agg.pierHits += Number(row.hits);
    }
    if (row.damage_blocked != null) {
      agg.blocked += Number(row.damage_blocked);
      agg.blockedBattles += battles;
    }
    // Cumulative holders: a 3-mark player also counts toward 1 and 2 marks, an
    // Ace toward all lower classes.
    const marks = row.marks_on_gun == null ? 0 : Number(row.marks_on_gun);
    if (marks >= 1) agg.moe1 += 1;
    if (marks >= 2) agg.moe2 += 1;
    if (marks >= 3) agg.moe3 += 1;
    const mom = row.mark_of_mastery == null ? 0 : Number(row.mark_of_mastery);
    if (mom >= 1) agg.momC3 += 1;
    if (mom >= 2) agg.momC2 += 1;
    if (mom >= 3) agg.momC1 += 1;
    if (mom >= 4) agg.momAce += 1;
  };

  const snapshots = `${region}_tank_snapshots`;
  const players = `${region}_players`;
  // Scan the whole table ordered by the unique (player_id, tank_id, battles)
  // index, all ASC so it matches the index exactly and Postgres streams it via
  // a plain index scan with NO sort (a DISTINCT ON with `battles DESC` forces a
  // mixed-order sort that spills tens of GB to pgsql_tmp and fills the disk on
  // EU's 291M rows). Because battles grows monotonically, the LAST row of each
  // (player_id, tank_id) run is the latest snapshot, so we keep the pending row
  // and flush it when the run changes.
  const query = `
    SELECT s.player_id AS player_id, p.account_id AS account_id,
           p.nickname AS nickname, s.tank_id AS tank_id, s.battles AS battles,
           s.wins AS wins, s.damage_dealt AS damage_dealt, s.spotted AS spotted,
           s.frags AS frags, s.dropped_capture_points AS dropped_capture_points,
           s.radio_assisted_damage AS radio_assisted_damage,
           s.track_assisted_damage AS track_assisted_damage,
           s.survived_battles AS survived_battles, s.hits AS hits,
           s.shots AS shots, s.piercings AS piercings,
           s.damage_blocked AS damage_blocked,
           s.marks_on_gun AS marks_on_gun, s.mark_of_mastery AS mark_of_mastery,
           p.winrate AS player_winrate
    FROM ${snapshots} s
    INNER JOIN ${players} p ON p.id = s.player_id
    WHERE s.battles >= ${MIN_BATTLES}
    ORDER BY s.player_id, s.tank_id, s.battles
  `;

  let pending: Record<string, unknown> | null = null;
  let pendingKey = "";
  // Reserve a dedicated connection so the planner hints stick for the cursor.
  // Disabling seqscan AND bitmapscan forces an ordered Index Scan on the
  // (player_id, tank_id, battles) index, which already yields the ORDER BY, so
  // Postgres never sorts (a bitmap/seq plan sorts 30M+ rows and spills tens of
  // GB to pgsql_tmp, which filled the disk on EU). Slower random heap I/O, but
  // this is a nightly job and reliability beats speed here.
  const conn = await pgClient.reserve();
  try {
    await conn`SET enable_seqscan = off`;
    await conn`SET enable_bitmapscan = off`;
    await conn.unsafe(query).cursor(CURSOR_BATCH, async (rows) => {
      for (const row of rows) {
        const key = `${row.player_id}:${row.tank_id}`;
        if (key !== pendingKey) {
          if (pending) process(pending);
          pendingKey = key;
        }
        pending = row; // ascending battles -> last row of the run is latest
      }
    });
  } finally {
    conn.release();
  }
  if (pending) process(pending);

  // Enrich the union of ranked players with clan tag/color in one batch.
  const uniqueIds = new Set<number>();
  for (const top of byTank.values()) {
    for (const k of METRIC_KEYS) {
      for (const e of top[k]) uniqueIds.add(e.accountId);
    }
  }
  if (uniqueIds.size > 0) {
    const clans = await getPlayerClansBatch(region, [...uniqueIds]);
    for (const top of byTank.values()) {
      for (const k of METRIC_KEYS) {
        for (const e of top[k]) {
          const clan = clans.get(e.accountId);
          if (clan) {
            e.clanTag = clan.tag;
            e.clanColor = clan.color;
          }
        }
      }
    }
  }

  const table = topPlayersByTankByRegion[region];
  const values: (typeof table.$inferInsert)[] = [];
  for (const [tankId, top] of byTank) {
    for (const k of METRIC_KEYS) {
      top[k].forEach((e, i) => {
        values.push({
          tankId,
          metric: METRIC_ENUM[k],
          rank: i + 1,
          accountId: e.accountId,
          nickname: e.nickname,
          clanTag: e.clanTag,
          clanColor: e.clanColor,
          battles: e.battles,
          avgDamage: e.avgDamage,
          winrate: e.winrate,
          value: e.value.toString(),
        });
      });
    }
  }

  // Server-wide averages: the battle-weighted aggregate is treated as one
  // "average" tank and scored the same way, so the ratings line up with how a
  // player row is rated.
  const statsTable = tankStatsByRegion[region];
  const num = (v: number | null) =>
    v != null && Number.isFinite(v) ? v.toString() : null;
  const statValues: (typeof statsTable.$inferInsert)[] = [];
  for (const [tankId, agg] of aggByTank) {
    const meta = encyclopedia[String(tankId)];
    if (!meta || agg.battles <= 0) continue;
    const aggTank: TankStats = {
      tank_id: tankId,
      mark_of_mastery: null,
      all: {
        battles: agg.battles,
        wins: agg.wins,
        damage_dealt: agg.damage,
        spotted: agg.spotted,
        frags: agg.frags,
        dropped_capture_points: agg.droppedCap,
        radio_assisted_damage: agg.assist,
        track_assisted_damage: 0,
        xp: 0,
      },
    };
    const wn7 = computeWN7(
      {
        battles: agg.battles,
        wins: agg.wins,
        frags: agg.frags,
        damageDealt: agg.damage,
        spotted: agg.spotted,
        droppedCapturePoints: agg.droppedCap,
      },
      meta.tier,
    );
    statValues.push({
      tankId,
      players: agg.players,
      avgBattles: agg.battles / agg.players,
      totalBattles: agg.battles,
      avgDamage: agg.damage / agg.battles,
      winrate: (agg.wins / agg.battles) * 100,
      wn7: num(wn7),
      wn8: num(computeWN8([aggTank], wn8Expected, encyclopedia, wn8Fallback)),
      wnx: num(computeWNX([aggTank], wnxExpected)),
      // Percentages stored 0-100 (like winrate); the rest raw. Each newer
      // metric is null until its snapshot coverage is non-zero.
      playerWr:
        agg.playerWrCount > 0
          ? (agg.playerWrSum / agg.playerWrCount) * 100
          : null,
      avgSpots: agg.spotted / agg.battles,
      avgAssist: agg.assist / agg.battles,
      kdr:
        agg.survBattles - agg.survived > 0
          ? agg.fragsCovered / (agg.survBattles - agg.survived)
          : null,
      hitPct: agg.shots > 0 ? (agg.hits / agg.shots) * 100 : null,
      penPct: agg.pierHits > 0 ? (agg.piercings / agg.pierHits) * 100 : null,
      avgBlocked:
        agg.blockedBattles > 0 ? agg.blocked / agg.blockedBattles : null,
      survival:
        agg.survBattles > 0 ? (agg.survived / agg.survBattles) * 100 : null,
      moe1: agg.moe1,
      moe2: agg.moe2,
      moe3: agg.moe3,
      momClass3: agg.momC3,
      momClass2: agg.momC2,
      momClass1: agg.momC1,
      momAce: agg.momAce,
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(table);
    for (let i = 0; i < values.length; i += 1000) {
      await tx.insert(table).values(values.slice(i, i + 1000));
    }
    await tx.delete(statsTable);
    for (let i = 0; i < statValues.length; i += 1000) {
      await tx.insert(statsTable).values(statValues.slice(i, i + 1000));
    }
  });

  return byTank.size;
}
