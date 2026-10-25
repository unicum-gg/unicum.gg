import { sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import { battlesByRegion, clansByRegion, playersByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import {
  playerBattlesWhere,
  type PlayerBattleFilter,
} from "@unicum.gg/core/battles/filters";

/**
 * Somebody this player keeps meeting in battle, on their side or across from
 * them.
 *
 * Wargaming publishes nothing about a single battle, let alone who was in it,
 * so this exists only because every battle we hold carries all thirty
 * vehicles. Turning the battle list sideways is the whole of it.
 */
export type PlayerBattleEncounter = {
  accountId: number;
  /** The name as it stands now on the player row. */
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
  /** The winner's crest, denormalised on the player row like every other list.
   * The auth-backed badges are attached at the API boundary. */
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  isVerified?: boolean;
  isSupporter?: boolean;
  twitchLogin?: string | null;
  onslaughtBestTier?: string | null;
  onslaughtBestRank?: number | null;
  onslaughtSeasons?: number;
  /** Battles the two were in on the side this list is about. */
  battles: number;
  /** Of those, the ones THIS player's team won, whichever side the other was on:
   * beside an ally it is the record together, against an opponent the record
   * against them. */
  wins: number;
  /** The wins this player would have taken from those same battles at their
   * usual rate in each battle's mode. A clan plays its Skirmishes together, and
   * a player who wins 70% of their randoms and 40% of their Skirmishes would
   * otherwise read every clanmate as costing them games. `wins - expected` is
   * what the other one made of it. */
  expected: number;
  /** The most recent of those battles. */
  lastAt: Date;
};

export type PlayerBattleEncounters = {
  allies: PlayerBattleEncounter[];
  opponents: PlayerBattleEncounter[];
};

/** How many rows each side shows. Past this the list stops being "who do you
 * keep meeting" and becomes everybody met twice. */
const ENCOUNTER_LIMIT = 24;

/**
 * Meeting somebody once says nothing: a random battle hands out twenty-nine
 * strangers. Twice is the first count that says the two keep crossing paths,
 * whether through a platoon, a clan, or a small pool at that tier and hour.
 */
const MIN_ENCOUNTERS = 2;

type EncounterRow = {
  account_id: string | number;
  ally: boolean;
  battles: string | number;
  wins: string | number;
  expected: string | number;
  last_at: string | Date;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  tournament_wins: number | null;
  tournament_featured_wins: number | null;
  tournament_best_title: string | null;
};

/**
 * Who this player meets most in the battles we hold, split by side.
 *
 * One pass: the account's battles come off the GIN index on `player_ids`
 * (a few hundred rows for the heaviest), each is unrolled into its vehicles,
 * and every other account in it is counted as an ally or an opponent by the
 * team it was on. Ranked per side in the same query, so the two lists cost one
 * read. Takes the battles tab's own filter, so narrowing the list to Onslaught
 * also narrows who is counted.
 *
 * The usual rate behind `expected` is read over the same filtered set, per
 * battle type, so a filter on one mode makes it that mode's rate alone.
 *
 * Accounts with no name on our player row are left out rather than shown as a
 * number: a row has to link somewhere, and the pipeline fills those names in on
 * its own.
 */
export async function playerBattleEncounters(
  region: Region,
  accountId: number,
  filter: PlayerBattleFilter = {},
): Promise<PlayerBattleEncounters> {
  const table = battlesByRegion[region];
  const players = playersByRegion[region];
  const clans = clansByRegion[region];

  const rows = (await db.execute(sql`
    WITH mine AS (
      SELECT ${table.arenaUniqueId} AS arena, ${table.startedAt} AS started_at,
        ${table.battleType} AS mode, ${table.winnerTeam} AS winner, ${table.vehicles} AS vehicles,
        (SELECT (v->>'team')::int FROM jsonb_array_elements(${table.vehicles}) AS v
          WHERE (v->>'account')::bigint = ${accountId} LIMIT 1) AS team
      FROM ${table}
      WHERE ${playerBattlesWhere(table, accountId, filter)}
    ),
    rates AS (
      SELECT mode, avg((winner = team)::int) AS rate
      FROM mine WHERE team IS NOT NULL
      GROUP BY mode
    ),
    pairs AS (
      SELECT DISTINCT mine.arena, (v->>'account')::bigint AS account_id,
        (v->>'team')::int = mine.team AS ally, mine.winner = mine.team AS won,
        rates.rate, mine.started_at
      FROM mine
      JOIN rates ON rates.mode = mine.mode,
        jsonb_array_elements(mine.vehicles) AS v
      WHERE mine.team IS NOT NULL
        AND v ? 'account'
        AND (v->>'account')::bigint <> ${accountId}
    ),
    met AS (
      SELECT account_id, ally, count(*)::int AS battles,
        count(*) FILTER (WHERE won)::int AS wins,
        sum(rate)::float8 AS expected,
        max(started_at) AS last_at
      FROM pairs
      GROUP BY 1, 2
      HAVING count(*) >= ${MIN_ENCOUNTERS}
    ),
    ranked AS (
      SELECT met.*, row_number() OVER (
        PARTITION BY met.ally ORDER BY met.battles DESC, met.last_at DESC
      ) AS rank
      FROM met
      JOIN ${players} p ON p.account_id = met.account_id AND p.nickname <> ''
    )
    SELECT r.account_id, r.ally, r.battles, r.wins, r.expected, r.last_at,
      p.nickname, c.tag AS clan_tag, c.color AS clan_color,
      p.tournament_wins, p.tournament_featured_wins, p.tournament_best_title
    FROM ranked r
    JOIN ${players} p ON p.account_id = r.account_id
    LEFT JOIN ${clans} c ON c.id = p.clan_id
    WHERE r.rank <= ${ENCOUNTER_LIMIT}
    ORDER BY r.battles DESC, r.last_at DESC
  `)) as unknown as EncounterRow[];

  const allies: PlayerBattleEncounter[] = [];
  const opponents: PlayerBattleEncounter[] = [];
  for (const row of rows) {
    (row.ally ? allies : opponents).push({
      accountId: Number(row.account_id),
      nickname: row.nickname,
      clanTag: row.clan_tag,
      clanColor: row.clan_color,
      tournamentWins: row.tournament_wins ?? 0,
      tournamentFeaturedWins: row.tournament_featured_wins ?? 0,
      tournamentBestTitle: row.tournament_best_title ?? null,
      battles: Number(row.battles),
      wins: Number(row.wins),
      expected: Number(row.expected),
      // A raw read never reaches drizzle's timestamp mapper, so the driver
      // hands back whatever it parsed.
      lastAt: new Date(row.last_at),
    });
  }
  return { allies, opponents };
}
