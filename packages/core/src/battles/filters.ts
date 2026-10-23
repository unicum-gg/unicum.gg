import { sql, type SQL } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import { BattleResultFilter, battlesByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";

/** What a player's battles list can be narrowed to. Every field is optional,
 * and the ones given all apply. */
export type PlayerBattleFilter = {
  /** The game's own `bonusType`: random, Onslaught, skirmish… */
  battleType?: number;
  /** The vehicle THIS account brought, by `typeCompDescr`. */
  tank?: number;
  /** The arena, by the game's own id. */
  map?: string;
  result?: BattleResultFilter;
};

type BattlesTable = (typeof battlesByRegion)[Region];

/** This account's own line in a battle, as SQL. */
const ownLine = (table: BattlesTable, accountId: number) => sql`(
  SELECT v FROM jsonb_array_elements(${table.vehicles}) AS v
  WHERE (v->>'account')::bigint = ${accountId}
  LIMIT 1
)`;

/**
 * The WHERE clause for one account's battles, narrowed by a filter.
 *
 * Always led by `player_ids @> [account]`, which is what the GIN index on
 * every partition answers: it cuts the table down to the battles this account
 * was in, a few hundred for the heaviest, and the rest is evaluated on those
 * rows alone. The vehicle and the result read the account's own line out of
 * the battle's `vehicles`, since a battle stores nobody's team or tank apart
 * from that array.
 */
export function playerBattlesWhere(
  table: BattlesTable,
  accountId: number,
  filter: PlayerBattleFilter = {},
): SQL {
  const parts: SQL[] = [sql`${table.playerIds} @> ARRAY[${accountId}]::bigint[]`];
  if (filter.battleType !== undefined) {
    parts.push(sql`${table.battleType} = ${filter.battleType}`);
  }
  if (filter.map !== undefined) {
    parts.push(sql`${table.mapName} = ${filter.map}`);
  }
  if (filter.tank !== undefined) {
    parts.push(sql`(${ownLine(table, accountId)}->>'tank')::int = ${filter.tank}`);
  }
  const ownTeam = sql`(${ownLine(table, accountId)}->>'team')::int`;
  if (filter.result === BattleResultFilter.Win) {
    parts.push(sql`${table.winnerTeam} = ${ownTeam}`);
  } else if (filter.result === BattleResultFilter.Loss) {
    parts.push(
      sql`${table.winnerTeam} IS NOT NULL AND ${table.winnerTeam} <> 0 AND ${table.winnerTeam} <> ${ownTeam}`,
    );
  } else if (filter.result === BattleResultFilter.Draw) {
    parts.push(sql`${table.winnerTeam} = 0`);
  }
  return sql.join(parts, sql` AND `);
}

/** One value a filter can take, and how many of the account's battles have it. */
export type BattleFacet<T> = { value: T; count: number };

/** Every value each filter can take for one account, most played first. */
export type PlayerBattleFacets = {
  modes: BattleFacet<number>[];
  tanks: BattleFacet<{
    id: number;
    name: string;
    shortName: string;
    tier: number;
  }>[];
  maps: BattleFacet<string>[];
  results: BattleFacet<BattleResultFilter>[];
};

/**
 * What the filters can offer this account: the modes, vehicles, maps and
 * results its battles actually have, counted.
 *
 * Counted over every battle rather than over the filtered list, so a chip says
 * what picking it would give from scratch and none of them disappears when
 * another is picked. Read as one row per battle and grouped here, which on the
 * same index as the list is a few hundred narrow rows for the heaviest account,
 * rather than four aggregate queries walking the same rows four times.
 */
export async function playerBattleFacets(
  region: Region,
  accountId: number,
): Promise<PlayerBattleFacets> {
  const table = battlesByRegion[region];
  const own = ownLine(table, accountId);
  const rows = await db
    .select({
      battleType: table.battleType,
      map: table.mapName,
      tank: sql<number | null>`(${own}->>'tank')::int`,
      team: sql<number | null>`(${own}->>'team')::int`,
      winner: table.winnerTeam,
    })
    .from(table)
    .where(playerBattlesWhere(table, accountId));

  const modes = new Map<number, number>();
  const tanks = new Map<number, number>();
  const maps = new Map<string, number>();
  const results = new Map<BattleResultFilter, number>();
  const bump = <K>(counts: Map<K, number>, key: K) =>
    counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const row of rows) {
    bump(modes, row.battleType);
    bump(maps, row.map);
    if (row.tank !== null) bump(tanks, row.tank);
    // A battle that named no winner is not a result anybody can filter on.
    if (row.winner === null || row.team === null) continue;
    bump(
      results,
      row.winner === 0
        ? BattleResultFilter.Draw
        : row.winner === row.team
          ? BattleResultFilter.Win
          : BattleResultFilter.Loss,
    );
  }

  const ranked = <K>(counts: Map<K, number>): BattleFacet<K>[] =>
    [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  const book = await getVehicleEncyclopedia(region);
  return {
    modes: ranked(modes),
    // A vehicle the catalogue does not know (a retired event copy) cannot be
    // named in a list, so it is left out of the choices rather than shown as
    // a number. Its battles are still in the unfiltered list.
    tanks: ranked(tanks).flatMap(({ value: id, count }) => {
      const meta = book[String(id)];
      return meta
        ? [
            {
              value: {
                id,
                name: meta.name,
                shortName: meta.shortName,
                tier: meta.tier,
              },
              count,
            },
          ]
        : [];
    }),
    maps: ranked(maps),
    // In the order the game itself reads them, not by count.
    results: [BattleResultFilter.Win, BattleResultFilter.Loss, BattleResultFilter.Draw]
      .filter((result) => results.has(result))
      .map((result) => ({ value: result, count: results.get(result)! })),
  };
}
