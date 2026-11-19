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
  /** The game update it was played on, `2.4.1`, whichever hotfix of it. */
  version?: string;
};

/**
 * The update a battle was played on, as SQL: `2.4.1` out of `2.4.1.1`.
 *
 * The update rather than the build: a hotfix (`2.4.1.0` to `2.4.1.1`) changes
 * nothing anybody compares battles on, and the oldest rows still carry the
 * client's whole version string (`World of Tanks v.2.4.0.0 #930`), which the
 * pattern reads the same way.
 */
export const battleUpdate = (table: BattlesTable) =>
  sql<string | null>`substring(${table.clientVersion} from '[0-9]+\\.[0-9]+\\.[0-9]+')`;

type BattlesTable = (typeof battlesByRegion)[Region];

/**
 * One account's own line in a battle, as SQL.
 *
 * The account is an SQL expression rather than a number, so the same reading
 * serves a player's own list (a literal id) and the replay catalogue, where
 * each battle is read from its own reporter's line (`reported_by[1]`).
 */
const ownLine = (table: BattlesTable, account: SQL) => sql`(
  SELECT v FROM jsonb_array_elements(${table.vehicles}) AS v
  WHERE (v->>'account')::bigint = ${account}
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
  return sql.join(
    [
      sql`${table.playerIds} @> ARRAY[${accountId}]::bigint[]`,
      ...battleFilterParts(table, sql`${accountId}`, filter),
    ],
    sql` AND `,
  );
}

/**
 * The conditions a filter sets on the battle itself: its mode, its map and the
 * update it was played on, whoever is read in it.
 */
export function battleLevelParts(
  table: BattlesTable,
  filter: PlayerBattleFilter = {},
): SQL[] {
  const parts: SQL[] = [];
  if (filter.battleType !== undefined) {
    parts.push(sql`${table.battleType} = ${filter.battleType}`);
  }
  if (filter.map !== undefined) {
    parts.push(sql`${table.mapName} = ${filter.map}`);
  }
  if (filter.version !== undefined) {
    parts.push(sql`${battleUpdate(table)} = ${filter.version}`);
  }
  return parts;
}

/**
 * The conditions a filter sets on one player's line in a battle (`line` is that
 * vehicle's JSON): the tank they brought and how the battle ended for them.
 */
export function lineFilterParts(
  table: BattlesTable,
  line: SQL,
  filter: PlayerBattleFilter = {},
): SQL[] {
  const parts: SQL[] = [];
  if (filter.tank !== undefined) {
    // Any tank of the lineup, not only the first: a Frontline battle fought
    // in three tanks is a battle in each of them, and `tank` alone names the
    // first one (see `BattleVehicle["tanks"]`).
    parts.push(
      sql`((${line}->>'tank')::int = ${filter.tank} OR ${line}->'tanks' @> jsonb_build_array(jsonb_build_object('tank', ${filter.tank}::int)))`,
    );
  }
  const team = sql`(${line}->>'team')::int`;
  if (filter.result === BattleResultFilter.Win) {
    parts.push(sql`${table.winnerTeam} = ${team}`);
  } else if (filter.result === BattleResultFilter.Loss) {
    parts.push(
      sql`${table.winnerTeam} IS NOT NULL AND ${table.winnerTeam} <> 0 AND ${table.winnerTeam} <> ${team}`,
    );
  } else if (filter.result === BattleResultFilter.Draw) {
    parts.push(sql`${table.winnerTeam} = 0`);
  }
  return parts;
}

/** A filter's conditions, read from one account's line in each battle. */
export function battleFilterParts(
  table: BattlesTable,
  account: SQL,
  filter: PlayerBattleFilter = {},
): SQL[] {
  return [
    ...battleLevelParts(table, filter),
    ...lineFilterParts(table, ownLine(table, account), filter),
  ];
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
  return battleFacets(
    region,
    sql`${accountId}`,
    playerBattlesWhere(table, accountId),
  );
}

/**
 * The facets of any set of battles, each counted from one account's line.
 *
 * `account` names whose line is read (a literal id, or `reported_by[1]` for the
 * replay catalogue) and `where` which battles are counted.
 */
export async function battleFacets(
  region: Region,
  account: SQL,
  where: SQL,
): Promise<PlayerBattleFacets> {
  const table = battlesByRegion[region];
  const own = ownLine(table, account);
  const rows = await db
    .select({
      battleType: table.battleType,
      map: table.mapName,
      tank: sql<number | null>`(${own}->>'tank')::int`,
      lineup: sql<{ tank: number | null }[] | null>`${own}->'tanks'`,
      team: sql<number | null>`(${own}->>'team')::int`,
      winner: table.winnerTeam,
    })
    .from(table)
    .where(where);
  return facetsFromRows(region, rows);
}

/** One battle as the facets count it, from the line of the account they follow. */
export type FacetRow = {
  battleType: number;
  map: string;
  tank: number | null;
  lineup: { tank: number | null }[] | null;
  team: number | null;
  winner: number | null;
};

/** The facets of rows already read, each counted once. */
export async function facetsFromRows(
  region: Region,
  rows: FacetRow[],
): Promise<PlayerBattleFacets> {
  const modes = new Map<number, number>();
  const tanks = new Map<number, number>();
  const maps = new Map<string, number>();
  const results = new Map<BattleResultFilter, number>();
  const bump = <K>(counts: Map<K, number>, key: K) =>
    counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const row of rows) {
    bump(modes, row.battleType);
    bump(maps, row.map);
    // Every tank of a Frontline lineup counts once, which is what picking it
    // in the filter above gives back.
    const fought = row.lineup?.length
      ? new Set(row.lineup.map((one) => one.tank))
      : new Set([row.tank]);
    for (const tank of fought) if (tank !== null) bump(tanks, tank);
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
