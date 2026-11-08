import { sql } from "drizzle-orm";
import {
  battlesByRegion,
  economyModeKey,
  loadoutModeOf,
  LOADOUT_MODES,
  MODE_ECONOMY_WINDOW_DAYS,
  type PlayerModeEconomy,
  type PlayerModeEconomyRow,
  vehiclesByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

type AggregateRow = {
  battle_type: number;
  tier: number;
  battles: number;
  wins: number;
  premium: number;
  seconds: string | number;
  alive: string | number;
  gross: string | number;
  repair: string | number;
  ammo: string | number;
  supplies: string | number;
};

type Totals = {
  battleType: number;
  tier: number;
  battles: number;
  wins: number;
  premium: number;
  seconds: number;
  alive: number;
  gross: number;
  repair: number;
  ammo: number;
  supplies: number;
};

/**
 * What each mode paid one player, tier by tier, over the region table's window.
 *
 * Only the battles the player uploaded count: `personal` belongs to the first
 * id in `reported_by`, and a battle somebody else uploaded holds their wallet,
 * not this one's. Read live rather than materialised, since it is one
 * account's few hundred battles found through the `player_ids` GIN index, the
 * same path the Battles tab's own list takes.
 *
 * `personal.credits` is the gross (measured above `creditsSubtotal` on nearly
 * every row and never equal to it less the bills), so the net is computed here.
 */
export async function playerModeEconomy(
  region: Region,
  accountId: number,
): Promise<PlayerModeEconomy> {
  const battles = battlesByRegion[region];
  const vehicles = vehiclesByRegion[region];
  // Every mode the player was paid in, events included: a battle that carries
  // no credits (training rooms, Fun Random) drops out on `personal ? 'credits'`
  // on its own. A vehicle the catalogue does not hold (an event's) is kept at
  // tier 0 rather than lost to the join.
  const rows = await db.execute<AggregateRow>(sql`
    WITH b AS (
      SELECT b.battle_type, b.duration, b.winner_team, b.personal,
             (SELECT v FROM jsonb_array_elements(b.vehicles) AS v
              WHERE (v->>'account')::bigint = ${accountId} LIMIT 1) AS own
      FROM ${battles} b
      WHERE b.player_ids @> ARRAY[${accountId}]::bigint[]
        AND b.reported_by[1] = ${accountId}
        AND b.started_at >= now() - make_interval(days => ${MODE_ECONOMY_WINDOW_DAYS})
        AND b.duration > 0
        AND b.personal ? 'credits'
    )
    SELECT b.battle_type, coalesce(veh.tier, 0)::int AS tier,
           count(*)::int AS battles,
           (count(*) FILTER (WHERE (b.own->>'team')::int = b.winner_team))::int AS wins,
           (count(*) FILTER (WHERE (b.personal->>'premium')::boolean))::int AS premium,
           sum(b.duration) AS seconds,
           sum(least(coalesce((b.own->>'lifeTime')::int, b.duration), b.duration)) AS alive,
           sum((b.personal->>'credits')::bigint) AS gross,
           coalesce(sum((b.personal->>'repairCost')::bigint), 0) AS repair,
           coalesce(sum((b.personal->>'ammoCost')::bigint), 0) AS ammo,
           coalesce(sum((b.personal->>'suppliesCost')::bigint), 0) AS supplies
    FROM b
    LEFT JOIN ${vehicles} veh ON veh.tank_id = (b.own->>'tank')::int
    GROUP BY b.battle_type, 2`);

  // Folded by the mode's name, so the game's variants of one mode are one row,
  // named after the variant that holds the most battles.
  const folded = new Map<string, Totals & { lead: number }>();
  for (const row of rows) {
    const key = `${economyModeKey(row.battle_type)}:${row.tier}`;
    const held = folded.get(key);
    const totals = held ?? {
      battleType: row.battle_type,
      tier: row.tier,
      lead: 0,
      battles: 0,
      wins: 0,
      premium: 0,
      seconds: 0,
      alive: 0,
      gross: 0,
      repair: 0,
      ammo: 0,
      supplies: 0,
    };
    if (row.battles > totals.lead) {
      totals.battleType = row.battle_type;
      totals.lead = row.battles;
    }
    totals.battles += row.battles;
    totals.wins += row.wins;
    totals.premium += row.premium;
    totals.seconds += Number(row.seconds);
    totals.alive += Number(row.alive);
    totals.gross += Number(row.gross);
    totals.repair += Number(row.repair);
    totals.ammo += Number(row.ammo);
    totals.supplies += Number(row.supplies);
    folded.set(key, totals);
  }

  const result: PlayerModeEconomyRow[] = [...folded.values()].map((row) => {
    const n = row.battles;
    const net = row.gross - row.repair - row.ammo - row.supplies;
    return {
      battleType: row.battleType,
      tier: row.tier,
      battles: n,
      winrate: row.wins / n,
      avgDuration: row.seconds / n,
      avgLifetime: row.alive / n,
      grossPerBattle: row.gross / n,
      repairPerBattle: row.repair / n,
      ammoPerBattle: row.ammo / n,
      suppliesPerBattle: row.supplies / n,
      netPerBattle: net / n,
      netPerMinute: row.seconds > 0 ? (net * 60) / row.seconds : 0,
      netPerMinuteAlive: row.alive > 0 ? (net * 60) / row.alive : 0,
      premiumShare: row.premium / n,
    };
  });
  // The four compared modes first, in the switch's order, then the rest.
  const order = (row: PlayerModeEconomyRow) => {
    const mode = loadoutModeOf(row.battleType);
    return mode ? LOADOUT_MODES.indexOf(mode) : LOADOUT_MODES.length;
  };
  result.sort((a, b) => b.tier - a.tier || order(a) - order(b) || b.battles - a.battles);
  return { accountId, windowDays: MODE_ECONOMY_WINDOW_DAYS, rows: result };
}
