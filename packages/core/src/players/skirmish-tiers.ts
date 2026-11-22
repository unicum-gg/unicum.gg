import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  TankBattleMode,
  playerSkirmishTiersByRegion,
  playersByRegion,
  tankModesByRegion,
  vehiclesByRegion,
  type StrongholdStats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { skirmishTierKey } from "@unicum.gg/core/players/skirmish-tier-history";

/** One column of the breakdown: a skirmish tier, or `null` for the battles
 * fought on vehicles of any other tier. */
export type PlayerSkirmishTier = {
  tier: number | null;
  vehicles: number;
  stats: StrongholdStats;
  /** What this tier gained over each window, null where the history does not
   * reach back that far yet. */
  periods: {
    h24: StrongholdStats | null;
    d7: StrongholdStats | null;
    d30: StrongholdStats | null;
  };
};

export type PlayerSkirmishTiers = {
  accountId: number;
  nickname: string;
  tiers: PlayerSkirmishTier[];
};

type Totals = {
  tier: number;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survived: number;
  frags: number;
  damage: number;
  spotted: number;
  capture: number;
  dropped: number;
  xp: number;
};

const ZERO: Omit<Totals, "tier"> = {
  battles: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  survived: 0,
  frags: 0,
  damage: 0,
  spotted: 0,
  capture: 0,
  dropped: 0,
  xp: 0,
};

function statsOf(t: Omit<Totals, "tier">): StrongholdStats {
  return {
    battles: t.battles,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
    survivedBattles: t.survived,
    frags: t.frags,
    damageDealt: t.damage,
    spotted: t.spotted,
    capturePoints: t.capture,
    droppedCapturePoints: t.dropped,
    battleAvgXp: t.battles > 0 ? t.xp / t.battles : 0,
  };
}

/** What a tier gained since `past`. A tier with no row then had no battles. */
function gained(now: Totals, past: Totals | undefined): StrongholdStats {
  const p = past ?? ZERO;
  return statsOf({
    battles: now.battles - p.battles,
    wins: now.wins - p.wins,
    losses: now.losses - p.losses,
    draws: now.draws - p.draws,
    survived: now.survived - p.survived,
    frags: now.frags - p.frags,
    damage: now.damage - p.damage,
    spotted: now.spotted - p.spotted,
    capture: now.capture - p.capture,
    dropped: now.dropped - p.dropped,
    xp: now.xp - p.xp,
  });
}

/**
 * Each tier's totals as they stood `days` ago, from the newest history row at
 * or before that instant.
 *
 * Null when the player has no row that old at all: their history then starts
 * inside the window and cannot say what came before it. A tier missing from a
 * non-null answer had no battles yet, since a player's first rows record every
 * tier they had played and a tier gets a row as soon as it moves.
 */
async function totalsAt(
  region: Region,
  playerId: number,
  days: number,
): Promise<Map<number, Totals> | null> {
  const h = playerSkirmishTiersByRegion[region];
  const rows = await db.execute<Totals>(sql`
    SELECT DISTINCT ON (${h.tier})
      ${h.tier}::int AS tier,
      ${h.battles} AS battles,
      ${h.wins} AS wins,
      ${h.losses} AS losses,
      ${h.draws} AS draws,
      ${h.survivedBattles} AS survived,
      ${h.frags} AS frags,
      ${h.damageDealt}::float8 AS damage,
      ${h.spotted} AS spotted,
      ${h.capturePoints} AS capture,
      ${h.droppedCapturePoints} AS dropped,
      ${h.xp}::float8 AS xp
    FROM ${h}
    WHERE ${h.playerId} = ${playerId}
      AND ${h.takenAt} <= now() - make_interval(days => ${days})
    ORDER BY ${h.tier}, ${h.takenAt} DESC
  `);
  if (rows.length === 0) return null;
  return new Map([...rows].map((r) => [r.tier, r]));
}

/**
 * A player's Skirmishes split by tier.
 *
 * Wargaming reports the account's Skirmish record as one block and splits it by
 * tier for clans only, so the split is rebuilt from the per-vehicle blocks: a
 * skirmish is fought at one tier with vehicles of that tier, so the vehicle's
 * tier IS the skirmish's. It reconciles to the account figure to the battle
 * (495 of 500 random EU accounts exact, the rest a refresh apart).
 *
 * What does not land on VI, VIII, X or XI comes from the years when a skirmish
 * capped the tier instead of fixing it (I-VI, I-VIII, I-X), about 2% of the
 * battles, and is returned as one `tier: null` column rather than as tiers
 * that are not played any more.
 *
 * The lifetime figures read `*_tank_modes`, which is current state; the
 * windows diff them against `*_player_skirmish_tiers`, the per-tier history
 * kept beside it (see `recordSkirmishTierHistory`).
 */
export async function getPlayerSkirmishTiers(
  region: Region,
  nickname: string,
): Promise<PlayerSkirmishTiers | null> {
  const players = playersByRegion[region];
  const modes = tankModesByRegion[region];
  const vehicles = vehiclesByRegion[region];

  const [player] = await db
    .select({ id: players.id, accountId: players.accountId, nickname: players.nickname })
    .from(players)
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
    .limit(1);
  if (!player) return null;

  const [rows, h24, d7, d30] = await Promise.all([
    db.execute<Totals & { vehicles: number }>(sql`
      SELECT
        ${skirmishTierKey(region)} AS tier,
        COUNT(*)::int AS vehicles,
        SUM(${modes.battles})::int AS battles,
        SUM(${modes.wins})::int AS wins,
        SUM(${modes.losses})::int AS losses,
        SUM(${modes.draws})::int AS draws,
        SUM(${modes.survivedBattles})::int AS survived,
        SUM(${modes.frags})::int AS frags,
        SUM(${modes.damageDealt})::float8 AS damage,
        SUM(${modes.spotted})::int AS spotted,
        SUM(${modes.capturePoints})::int AS capture,
        SUM(${modes.droppedCapturePoints})::int AS dropped,
        SUM(${modes.xp})::float8 AS xp
      FROM ${modes}
      LEFT JOIN ${vehicles} ON ${vehicles.tankId} = ${modes.tankId}
      WHERE ${modes.playerId} = ${player.id}
        AND ${modes.mode} = ${TankBattleMode.Skirmish}
      GROUP BY 1
    `),
    totalsAt(region, player.id, 1),
    totalsAt(region, player.id, 7),
    totalsAt(region, player.id, 30),
  ]);

  const period = (past: Map<number, Totals> | null, now: Totals) =>
    past ? gained(now, past.get(now.tier)) : null;

  return {
    accountId: player.accountId,
    nickname: player.nickname,
    tiers: [...rows]
      .filter((r) => r.battles > 0)
      // The live tiers in order, the older formats (0) last.
      .sort((a, b) => (a.tier || Infinity) - (b.tier || Infinity))
      .map((r) => ({
        tier: r.tier === 0 ? null : r.tier,
        vehicles: r.vehicles,
        stats: statsOf(r),
        periods: {
          h24: period(h24, r),
          d7: period(d7, r),
          d30: period(d30, r),
        },
      })),
  };
}
