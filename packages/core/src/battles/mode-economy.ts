import { sql } from "drizzle-orm";
import {
  BATTLE_MODE_LABEL,
  battlesByRegion,
  economyModeKey,
  LOADOUT_MODES,
  MODE_ECONOMY_MIN_RECORDS,
  MODE_ECONOMY_WINDOW_DAYS,
  type ModeEconomy,
  type ModeEconomyRow,
  modeEconomyByRegion,
  vehiclesByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * What each battle mode pays at each tier (see `ModeEconomy` for what is
 * counted and why), rebuilt from the recorded battles into `*_mode_economy`.
 *
 * Rides the hourly player-distribution cron rather than a schedule of its own:
 * it is one more region-wide aggregate feeding the same servers page, and the
 * point of that loop is that its scans run one after another rather than
 * stacking on the shared pool.
 */

type AggregateRow = {
  mode: string;
  tier: number;
  battles: number;
  records: number;
  players: number;
  wins: number;
  credits: string | number;
  xp: string | number;
  seconds: string | number;
  net_records: number;
  net_players: number;
  net_gross: string | number;
  net_costs: string | number;
};

/** `economyModeKey` as one SQL `CASE` over a battles row aliased `b`. The
 * accounts behind a row are counted distinct, so the game's variants of a mode
 * have to be folded before the aggregate rather than summed after it. */
export function modeOfBattleType() {
  const branches = Object.keys(BATTLE_MODE_LABEL).map(Number).map(
    (type) => sql`WHEN ${type} THEN ${economyModeKey(type)}`,
  );
  return sql`CASE b.battle_type ${sql.join(branches, sql` `)} ELSE 'type-' || b.battle_type END`;
}

/**
 * One pass over the window's battles, grouped by (mode, tier).
 *
 * Every mode that paid anything counts: a (mode, tier) whose credits sum to
 * nothing (training rooms, Fun Random) is left out by the `HAVING` rather than
 * by a list of modes. A record is one account's vehicle in one battle, the
 * whole battle for a player who respawned in several; bots (no account) are
 * left out, and an event's vehicle sits at tier 0 (its declared tier says
 * nothing a Random vehicle of that tier could be compared with). The uploader's own economy is joined onto their
 * record alone: `personal` belongs to the first id in `reported_by`, and its
 * `credits` is the gross (premium and bonuses in, bills not yet paid), so the
 * three bills are subtracted here to get what landed in the account.
 *
 * Read-only and exported so it can be run by hand without touching the table.
 */
export async function aggregateModeEconomy(region: Region): Promise<AggregateRow[]> {
  const battles = battlesByRegion[region];
  const vehicles = vehiclesByRegion[region];
  return db.execute<AggregateRow>(sql`
    WITH b AS (
      SELECT b.arena_unique_id, b.duration, b.winner_team, b.vehicles,
             b.personal, b.reported_by[1] AS reporter,
             ${modeOfBattleType()} AS mode
      FROM ${battles} b
      WHERE b.started_at >= now() - make_interval(days => ${MODE_ECONOMY_WINDOW_DAYS})
        AND b.duration > 0
    ),
    records AS (
      SELECT b.mode, coalesce(veh.tier, 0)::int AS tier, b.arena_unique_id, b.duration,
             (v->>'account')::bigint AS account,
             (v->>'credits')::bigint AS credits,
             (v->>'xp')::bigint AS xp,
             (v->>'team')::int = b.winner_team AS won,
             CASE WHEN (v->>'account')::bigint = b.reporter
                       AND b.personal ? 'credits'
                  THEN b.personal END AS personal
      FROM b
      CROSS JOIN LATERAL jsonb_array_elements(b.vehicles) v
      LEFT JOIN ${vehicles} veh ON veh.tank_id = (v->>'tank')::int AND NOT veh.is_hidden
      WHERE v ? 'account'
    )
    SELECT mode, tier,
           count(DISTINCT arena_unique_id)::int AS battles,
           count(*)::int AS records,
           count(DISTINCT account)::int AS players,
           (count(*) FILTER (WHERE won))::int AS wins,
           coalesce(sum(credits), 0) AS credits,
           coalesce(sum(xp), 0) AS xp,
           sum(duration) AS seconds,
           count(personal)::int AS net_records,
           (count(DISTINCT account) FILTER (WHERE personal IS NOT NULL))::int AS net_players,
           coalesce(sum((personal->>'credits')::bigint), 0) AS net_gross,
           coalesce(sum(
             coalesce((personal->>'repairCost')::bigint, 0)
             + coalesce((personal->>'ammoCost')::bigint, 0)
             + coalesce((personal->>'suppliesCost')::bigint, 0)
           ) FILTER (WHERE personal IS NOT NULL), 0) AS net_costs
    FROM records
    GROUP BY mode, tier
    HAVING coalesce(sum(credits), 0) > 0`);
}

/** Recompute one region and replace its rows. Returns how many were written. */
export async function recomputeModeEconomy(region: Region): Promise<number> {
  const rows = await aggregateModeEconomy(region);
  const target = modeEconomyByRegion[region];
  await db.transaction(async (tx) => {
    await tx.delete(target);
    if (rows.length === 0) return;
    await tx.insert(target).values(
      rows.map((row) => ({
        mode: row.mode,
        tier: row.tier,
        windowDays: MODE_ECONOMY_WINDOW_DAYS,
        battles: row.battles,
        records: row.records,
        players: row.players,
        wins: row.wins,
        credits: Number(row.credits),
        xp: Number(row.xp),
        seconds: Number(row.seconds),
        netRecords: row.net_records,
        netPlayers: row.net_players,
        netGross: Number(row.net_gross),
        netCosts: Number(row.net_costs),
      })),
    );
  });
  return rows.length;
}

/**
 * Read one region's stored rows, ratios derived here. Null before the first
 * run; a row under `MODE_ECONOMY_MIN_RECORDS` is dropped rather than served,
 * since a mean over a handful of credit figures is whoever top-scored in them.
 */
export async function loadModeEconomy(region: Region): Promise<ModeEconomy | null> {
  const stored = await db.select().from(modeEconomyByRegion[region]);
  if (stored.length === 0) return null;

  const per = (value: number, whole: number) => (whole > 0 ? value / whole : 0);
  const order = new Map<string, number>(LOADOUT_MODES.map((mode, index) => [mode, index]));
  const rank = (mode: string) => order.get(mode) ?? LOADOUT_MODES.length;
  const rows: ModeEconomyRow[] = stored
    .filter((row) => row.records >= MODE_ECONOMY_MIN_RECORDS)
    .map((row) => {
      const net = row.netRecords > 0;
      return {
        mode: row.mode,
        tier: row.tier,
        battles: row.battles,
        records: row.records,
        players: row.players,
        creditsPerBattle: per(row.credits, row.records),
        creditsPerMinute: per(row.credits * 60, row.seconds),
        xpPerBattle: per(row.xp, row.records),
        xpPerMinute: per(row.xp * 60, row.seconds),
        avgDuration: per(row.seconds, row.records),
        winrate: per(row.wins, row.records),
        netRecords: row.netRecords,
        netPlayers: row.netPlayers,
        grossPerBattle: net ? row.netGross / row.netRecords : null,
        costsPerBattle: net ? row.netCosts / row.netRecords : null,
        netPerBattle: net ? (row.netGross - row.netCosts) / row.netRecords : null,
      };
    })
    .sort(
      (a, b) =>
        b.tier - a.tier || rank(a.mode) - rank(b.mode),
    );

  return {
    region,
    windowDays: stored[0]!.windowDays,
    rows,
    computedAt: stored.reduce<Date | null>(
      (latest, row) =>
        !latest || row.computedAt > latest ? row.computedAt : latest,
      null,
    ),
  };
}
