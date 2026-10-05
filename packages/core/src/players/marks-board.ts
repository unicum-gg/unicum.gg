import { sql } from "drizzle-orm";
import {
  clansByRegion,
  DEFAULT_MARKS_SORT,
  MARKS_MIN_BATTLES,
  parseMarksSort,
  type PlayerMarksTable,
  playerMarksByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { createRegionCache } from "@unicum.gg/core/lib/region-cache";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The Marks of Excellence leaderboard: who holds the most three-mark guns.
 *
 * A cheap read of `*_player_marks`, which the portal refresh keeps up to date
 * (see that table for why nothing here recounts from the snapshots). The totals
 * are an indexed column and the per-tier columns are an array subscript, so the
 * whole board is one index scan plus a sort of the few tens of thousands of
 * accounts that hold a three-mark gun at all.
 *
 * The battle floor is applied to the marks row rather than to the players row
 * it joins, which is the difference between sorting that small table and
 * joining the whole ranked set before anything can be ordered. See the column
 * for why it is denormalised, and note that the battle count the board DISPLAYS
 * still comes from the join, so a reader sees the current figure.
 */

export type MarksBoardRow = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  /** Three-mark guns across every tier. */
  marks3: number;
  /** The per-tier tally, index `i` holding tier `i + 1`. Every column the board
   * draws is read out of this, so adding a tier adds a column rather than a
   * field. Shorter than the tier count when the player holds none at the top. */
  marks3_by_tier: number[];
  /** Guns at the lower levels, for the row's own context: three marks mean more
   * on a garage of forty than on one of nine hundred. */
  marks2: number;
  marks1: number;
  /** Vehicles a mark level was read for, this row's own denominator. */
  known: number;
  /** The newest observation these counts were taken from. See the column on
   * `*_player_marks`: exact for a portal read, an upper bound for an account
   * the backfill seeded. */
  measured_at: Date;
  languages: string[];
};

type RawRow = {
  account_id: number | string;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  marks3: number;
  marks3_by_tier: number[] | null;
  marks2: number;
  marks1: number;
  known: number;
  measured_at: Date | string;
  languages: string[] | null;
};

/**
 * One tier out of the stored array, in SQL.
 *
 * Postgres subscripts arrays from ONE while the TypeScript side reads
 * `byTier[tier - 1]`, so the two spellings of "tier ten" differ by one and
 * writing either by hand is how they come apart. Both go through a named
 * helper for that reason: this one, and `markCountAtTier` in shared.
 */
function tierCount(column: PlayerMarksTable["marks3ByTier"], tier: number) {
  return sql<number>`COALESCE(${column}[${tier}], 0)`;
}

/** What each column ranks by, descending. */
function orderBy(region: Region, sort: string) {
  const marks = playerMarksByRegion[region];
  // An unparseable sort ranks by the total rather than erroring: the set of
  // tiers is the game's, so a caller naming one we do not have is asking a
  // reasonable question about a tier nobody has marked.
  const tier = parseMarksSort(sort) ?? null;
  if (tier == null) return sql`${marks.marks3Total} DESC`;
  // Ties on a single tier are common (hundreds of accounts hold exactly one
  // three-mark tier XI gun), so the total breaks them rather than leaving the
  // order to whichever row the scan reached first, which would reshuffle the
  // board between two identical requests.
  return sql`${tierCount(marks.marks3ByTier, tier)} DESC, ${marks.marks3Total} DESC`;
}

export async function getMarksBoard(
  region: Region,
  {
    sort = DEFAULT_MARKS_SORT,
    limit,
    language = null,
    strict = false,
  }: {
    sort?: string;
    limit: number;
    language?: string | null;
    strict?: boolean;
  },
): Promise<MarksBoardRow[]> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const clans = clansByRegion[region];

  // `strict` is the by-language board's own reading: the inferred set is
  // exactly this language, with no co-dominant second one.
  const langClause = language
    ? strict
      ? sql`AND ${marks.languages} = ARRAY[${language}]::text[]`
      : sql`AND ${language} = ANY(${marks.languages})`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      p.account_id, p.nickname, p.battles, p.wn7, p.wn8, p.wnx,
      c.tag AS clan_tag, c.color AS clan_color,
      ${marks.marks3Total} AS marks3,
      ${marks.marks3ByTier} AS marks3_by_tier,
      ${marks.marks2Total} AS marks2,
      ${marks.marks1Total} AS marks1,
      ${marks.known} AS known,
      ${marks.measuredAt} AS measured_at,
      ${marks.languages} AS languages
    FROM ${marks}
    INNER JOIN ${players} p ON p.account_id = ${marks.accountId}
    LEFT JOIN ${clans} c ON c.id = p.clan_id
    WHERE ${marks.marks3Total} > 0
      AND ${marks.battles} >= ${MARKS_MIN_BATTLES}
      AND p.soft_deleted_at IS NULL
      ${langClause}
    ORDER BY ${orderBy(region, sort)}
    LIMIT ${limit}
  `)) as unknown as RawRow[];

  return rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    wn7: r.wn7 == null ? null : Number(r.wn7),
    wn8: r.wn8 == null ? null : Number(r.wn8),
    wnx: r.wnx == null ? null : Number(r.wnx),
    marks3: Number(r.marks3),
    marks3_by_tier: r.marks3_by_tier ?? [],
    marks2: Number(r.marks2),
    marks1: Number(r.marks1),
    known: Number(r.known),
    measured_at: new Date(r.measured_at),
    languages: r.languages ?? [],
  }));
}

export type MarksLanguageStats = {
  code: string;
  total: number;
  strict: number;
};

export type MarksBoardMeta = {
  languages: MarksLanguageStats[];
  /**
   * The tiers the board has a column for: every tier at least one ranked
   * account holds a three-mark gun at, ascending.
   *
   * Derived from the rows rather than from a list of tiers, exactly as the
   * vehicle catalogue derives its tier chips from the vehicles it was handed. A
   * tier Wargaming adds therefore becomes a column the day somebody marks a gun
   * at it, and a tier nobody has marked does not take a column up saying
   * nothing. Tier XI was added to the game this way, which is the argument.
   */
  tiers: number[];
  coverage: MarksCoverage;
};

/**
 * What the board is drawn from, which is the part a reader has to be told.
 *
 * Marks come from the WoT portal at about one request a second per region, so
 * they are only read when somebody looks a profile up. `ranked` is the accounts
 * holding a three-mark gun, `measured` every account we have read a garage for
 * at all, and the gap between `measured` and the region's tracked population is
 * the board's blind spot. Published rather than hidden, the way the activity
 * panel publishes `observed`: a ranking that looks complete and is not is worse
 * than one that says what it covers.
 */
export type MarksCoverage = {
  ranked: number;
  measured: number;
  tracked: number;
  /** The newest and the oldest observation on the board, so the page can say
   * how current the ranking is rather than implying it is live. */
  newest: Date | null;
  oldest: Date | null;
};

/**
 * How long the board's surroundings are held.
 *
 * All of it rides every board response, including the one a header click
 * re-fetches, and none of it is cheap: the coverage denominator is a parallel
 * sequential scan of the region's whole player table (797ms on EU) and the
 * language counts walk every ranked row. None of the numbers can move
 * meaningfully inside an hour either, since each is a population in the
 * thousands or the millions moving by whoever was looked up since. The same
 * pattern, and the same reason, as the marks thresholds the profile reads
 * (`getTankMoeByRegion`): a full scan is harmless on a page that renders once
 * and not on an endpoint a reader can call by clicking.
 *
 * One cached read rather than three, so the chips, the tier columns and the
 * coverage are always from the same instant and cannot describe three
 * populations.
 */
const META_TTL_MS = 60 * 60 * 1000;

const metaCache = createRegionCache(loadMarksBoardMeta, META_TTL_MS);

export function getMarksBoardMeta(region: Region): Promise<MarksBoardMeta> {
  return metaCache.get(region);
}

async function loadMarksBoardMeta(region: Region): Promise<MarksBoardMeta> {
  const [languages, tiers, coverage] = await Promise.all([
    loadMarksLanguageStats(region),
    loadMarksTiers(region),
    loadMarksCoverage(region),
  ]);
  return { languages, tiers, coverage };
}

/**
 * The languages present on the board, with how many accounts each holds.
 *
 * Counted over the very population the board ranks (the same three predicates),
 * so a chip saying 240 and a board showing 240 rows agree by construction. That
 * is why this does not reuse `getPlayerLanguageStats`: that one counts over
 * `*_player_ratings`, a different and much narrower pool (ten thousand battles
 * and a place in a metric's top ten thousand), and its numbers would be
 * describing a set this board never shows.
 */
async function loadMarksLanguageStats(
  region: Region,
): Promise<MarksLanguageStats[]> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const rows = (await db.execute(sql`
    SELECT
      lang AS code,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE array_length(${marks.languages}, 1) = 1)::int AS strict
    FROM ${marks}
    INNER JOIN ${players} p ON p.account_id = ${marks.accountId},
      LATERAL unnest(${marks.languages}) AS lang
    WHERE ${marks.marks3Total} > 0
      AND ${marks.battles} >= ${MARKS_MIN_BATTLES}
      AND p.soft_deleted_at IS NULL
    GROUP BY lang
    ORDER BY total DESC
  `)) as unknown as Array<{ code: string; total: number; strict: number }>;
  return rows.map((r) => ({
    code: r.code,
    total: r.total,
    strict: r.strict,
  }));
}

/**
 * Which tiers anybody on the board has a three-mark gun at.
 *
 * `generate_subscripts` walks each stored tally rather than a list of tiers we
 * keep here, so the answer is whatever the rows contain and a tier the game
 * gains needs no change anywhere. Ordered ascending, which is the order the
 * columns are drawn in.
 */
async function loadMarksTiers(region: Region): Promise<number[]> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const rows = (await db.execute(sql`
    SELECT DISTINCT tier AS tier
    FROM ${marks}
    INNER JOIN ${players} p ON p.account_id = ${marks.accountId},
      LATERAL generate_subscripts(${marks.marks3ByTier}, 1) AS tier
    WHERE ${marks.marks3Total} > 0
      AND ${marks.battles} >= ${MARKS_MIN_BATTLES}
      AND p.soft_deleted_at IS NULL
      AND ${marks.marks3ByTier}[tier] > 0
    ORDER BY tier
  `)) as unknown as Array<{ tier: number }>;
  return rows.map((r) => Number(r.tier));
}

async function loadMarksCoverage(region: Region): Promise<MarksCoverage> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const [row] = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE ${marks.marks3Total} > 0)::int AS ranked,
      COUNT(*)::int AS measured,
      MAX(${marks.measuredAt}) FILTER (WHERE ${marks.marks3Total} > 0) AS newest,
      MIN(${marks.measuredAt}) FILTER (WHERE ${marks.marks3Total} > 0) AS oldest
    FROM ${marks}
  `)) as unknown as Array<{
    ranked: number;
    measured: number;
    newest: Date | string | null;
    oldest: Date | string | null;
  }>;
  // The denominator is the accounts the board could ever rank, which is the
  // same floor the board applies rather than every row in the table: counting
  // against the whole region would call a thirty-battle account a blind spot.
  const [tracked] = (await db.execute(sql`
    SELECT COUNT(*)::int AS tracked
    FROM ${players} p
    WHERE p.battles >= ${MARKS_MIN_BATTLES} AND p.soft_deleted_at IS NULL
  `)) as unknown as Array<{ tracked: number }>;

  return {
    ranked: row?.ranked ?? 0,
    measured: row?.measured ?? 0,
    tracked: tracked?.tracked ?? 0,
    newest: row?.newest ? new Date(row.newest) : null,
    oldest: row?.oldest ? new Date(row.oldest) : null,
  };
}
