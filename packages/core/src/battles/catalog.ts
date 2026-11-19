import { sql, type SQL } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  BattleCatalogSort,
  battleReplays,
  battlesByRegion,
  clansByRegion,
  loadoutPrivacy,
  playersByRegion,
  type TopBattle,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import {
  battleLevelParts,
  facetsFromRows,
  battleUpdate,
  lineFilterParts,
  type BattleFacet,
  type FacetRow,
  type PlayerBattleFacets,
  type PlayerBattleFilter,
} from "@unicum.gg/core/battles/filters";

/**
 * The replay catalogue: every `.wotreplay` we archived, ranked by what was done
 * in it or by date.
 *
 * A row IS a replay, so it is drawn from the player who recorded it (`replay_by`,
 * read from the file's own header): their vehicle, their figures, their result.
 * That is the one point of view a replay holds. It records what the server sent
 * that one client, with that client's own camera and aim, so another player's
 * view of the same battle is not in the file at all.
 *
 * A recorder who keeps their battle list to themselves is left out, with their
 * replays, and so is an account we do not track (it has no name to show). Only
 * the keys and the players are read here; the endpoint draws each battle
 * through the Battles tab's own reader.
 */

type BattlesTable = (typeof battlesByRegion)[Region];

/** One vehicle of the battle being read, inside the lateral below. */
const line = sql.raw("v");

/** The recording being read: one row of `battle_replays`, aliased `rr`. */
const recorder = sql.raw("rr.account_id");

/** Every recording joined to its battle: the catalogue's rows, one per file. */
function recordings(region: Region): SQL {
  const table = battlesByRegion[region];
  return sql`${battleReplays} rr
    JOIN ${table} ON ${table.arenaUniqueId} = rr.arena_unique_id
      AND ${table.startedAt} = rr.started_at`;
}

/** What a replay is ranked by, for the order asked for, from its recorder's
 * line. Recent orders by date and keeps the damage as its tie-break. */
function score(sort: BattleCatalogSort): SQL {
  const field = (name: string) => sql`coalesce((${line}->>${name})::int, 0)`;
  switch (sort) {
    case BattleCatalogSort.Assist:
      // What the post-battle panel calls assisted damage: by spotting, by
      // tracking and by stunning, together.
      return sql`(${field("radio")} + ${field("track")} + ${field("stun")})`;
    case BattleCatalogSort.Xp:
      return field("xp");
    case BattleCatalogSort.Kills:
      return field("kills");
    case BattleCatalogSort.Damage:
    case BattleCatalogSort.Recent:
    case BattleCatalogSort.Views:
    case BattleCatalogSort.Downloads:
      // The views and downloads rank on the recording itself (see the ORDER
      // BY); the damage still picks the line and breaks their ties.
      return field("damage");
  }
}

/** The recording-level conditions: this region, and the filter's mode, map and update. */
function battleWhere(region: Region, filter: PlayerBattleFilter): SQL {
  const table = battlesByRegion[region];
  return sql.join(
    [sql`rr.region = ${region}`, ...battleLevelParts(table, filter)],
    sql` AND `,
  );
}

/**
 * The recorder's own line of the current battle, when a row may be drawn from
 * it: a tracked account that does not hide its battles, matching the filter's
 * vehicle and result. Written as the FROM of a subquery over the outer battle's
 * `vehicles`, so it yields one line or none.
 */
function eligibleLines(region: Region, filter: PlayerBattleFilter): SQL {
  const table = battlesByRegion[region];
  const players = playersByRegion[region];
  const conditions = [
    sql`(${line}->>'account')::bigint = ${recorder}`,
    sql`EXISTS (SELECT 1 FROM ${players} p WHERE p.account_id = ${recorder})`,
    sql`NOT EXISTS (
      SELECT 1 FROM ${loadoutPrivacy} lp
      WHERE lp.wargaming_account = ${region} || '-' || ${recorder}::text
        AND lp.battles_hidden
    )`,
    ...lineFilterParts(table, line, filter),
  ];
  return sql`jsonb_array_elements(${table.vehicles}) AS v
    WHERE ${line} ? 'account' AND ${sql.join(conditions, sql` AND `)}`;
}

type CatalogRow = {
  arena_unique_id: string;
  started_at: string | Date;
  account_id: string | number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  views: number | null;
  downloads: number | null;
};

/** One page of the catalogue, as battle keys and the recorder of each. */
export async function catalogBattles(
  region: Region,
  filter: PlayerBattleFilter,
  sort: BattleCatalogSort,
  limit: number,
  offset: number,
): Promise<TopBattle[]> {
  const table = battlesByRegion[region];
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const order =
    sort === BattleCatalogSort.Recent
      ? sql`${table.startedAt}`
      : sort === BattleCatalogSort.Views
        ? sql`rr.views`
        : sort === BattleCatalogSort.Downloads
          ? sql`rr.downloads`
          : sql`lead.score`;
  const rows = (await db.execute(sql`
    SELECT ${table.arenaUniqueId} AS arena_unique_id,
           ${table.startedAt} AS started_at,
           lead.account_id, p.nickname, c.tag AS clan_tag, c.color AS clan_color,
           rr.views, rr.downloads
    FROM ${recordings(region)}
    CROSS JOIN LATERAL (
      SELECT (${line}->>'account')::bigint AS account_id, ${score(sort)} AS score
      FROM ${eligibleLines(region, filter)}
      ORDER BY 2 DESC
      LIMIT 1
    ) lead
    JOIN ${players} p ON p.account_id = lead.account_id
    LEFT JOIN ${clans} c ON c.id = p.clan_id
    WHERE ${battleWhere(region, filter)}
    ORDER BY ${order} DESC, ${table.startedAt} DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as CatalogRow[];
  if (rows.length === 0) return [];

  const badges = await resolvePlayerBadges(
    region,
    rows.map((row) => Number(row.account_id)),
  );
  return rows.map((row) => {
    const accountId = Number(row.account_id);
    const badge = badges.get(accountId);
    return {
      arenaUniqueId: row.arena_unique_id,
      startedAt: new Date(row.started_at),
      nickname: row.nickname,
      accountId,
      clanTag: row.clan_tag,
      clanColor: row.clan_color,
      isVerified: badge?.verified ?? false,
      isSupporter: badge?.supporter ?? false,
      twitchLogin: badge?.twitchLogin ?? null,
      tournamentWins: badge?.tournamentWins ?? 0,
      tournamentFeaturedWins: badge?.tournamentFeaturedWins ?? 0,
      tournamentBestTitle: badge?.tournamentBestTitle ?? null,
      onslaughtBestTier: badge?.onslaughtBestTier ?? null,
      onslaughtBestRank: badge?.onslaughtBestRank ?? null,
      onslaughtSeasons: badge?.onslaughtSeasons ?? 0,
      views: Number(row.views ?? 0),
      downloads: Number(row.downloads ?? 0),
    } satisfies TopBattle;
  });
}

/** How many battles the catalogue holds under a filter, for the pager. */
export async function countCatalogBattles(
  region: Region,
  filter: PlayerBattleFilter,
): Promise<number> {
  const table = battlesByRegion[region];
  const [row] = (await db.execute(sql`
    SELECT count(*)::int AS count FROM ${recordings(region)}
    WHERE ${battleWhere(region, filter)}
      AND EXISTS (SELECT 1 FROM ${eligibleLines(region, filter)})
  `)) as unknown as { count: number }[];
  return row?.count ?? 0;
}

/**
 * What the catalogue's filters can offer, counted from each replay's recorder:
 * the modes and maps of the replays, the vehicles they were recorded in, and
 * how those battles ended for them.
 */
export async function catalogFacets(region: Region): Promise<PlayerBattleFacets> {
  const table = battlesByRegion[region];
  const own = sql`(SELECT ${line} FROM ${eligibleLines(region, {})} LIMIT 1)`;
  const rows = (await db.execute(sql`
    SELECT ${table.battleType} AS "battleType", ${table.mapName} AS map,
           (own.v->>'tank')::int AS tank, own.v->'tanks' AS lineup,
           (own.v->>'team')::int AS team, ${table.winnerTeam} AS winner
    FROM ${recordings(region)}
    CROSS JOIN LATERAL (SELECT ${own} AS v) own
    WHERE ${battleWhere(region, {})} AND own.v IS NOT NULL
  `)) as unknown as FacetRow[];
  return facetsFromRows(region, rows);
}

/** `2.4.1` against `2.3.10`, component by component, newest first. */
function newestFirst(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The game updates the catalogue holds battles from, newest first, counted.
 *
 * Read from the battles rather than from the client mirror: "the current
 * version" a reader asks for is the newest one replays exist for, so the day an
 * update lands the catalogue keeps showing the previous one until a battle of
 * the new one has been recorded, rather than an empty list.
 */
export async function catalogVersions(
  region: Region,
): Promise<BattleFacet<string>[]> {
  const table = battlesByRegion[region];
  const rows = (await db.execute(sql`
    SELECT ${battleUpdate(table)} AS version, count(*)::int AS count
    FROM ${recordings(region)}
    WHERE ${battleWhere(region, {})}
      AND EXISTS (SELECT 1 FROM ${eligibleLines(region, {})})
    GROUP BY 1
  `)) as unknown as { version: string | null; count: number }[];
  return rows
    .filter((row): row is { version: string; count: number } => row.version !== null)
    .map((row) => ({ value: row.version, count: row.count }))
    .sort((a, b) => newestFirst(a.value, b.value));
}
