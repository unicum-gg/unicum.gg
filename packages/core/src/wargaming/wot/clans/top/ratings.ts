import { sql } from "drizzle-orm";
import {
  type ClanRatingsTable,
  clanMembersByRegion,
  clanRatingsByRegion,
  clansByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

// Only materialize clans with at least this many rated members for a metric.
// Matches MIN_MEMBERS_BY_LANGUAGE (the lowest floor any board applies), so the
// table covers both the language boards (floor 25) and the global one (floor
// 50) while staying lean — no point storing dormant 3-member clans.
const MIN_RATED = 25;

// Floor the badge rank is computed over: the global board's own eligibility
// (`MIN_MEMBERS_GLOBAL` in `top/by-language`, applied to both member counts).
// A badge has to mean "first on the leaderboard you can go and look at", so the
// two have to be the same population. Kept in sync by hand rather than imported
// because that module lives in `apps/web` and core cannot depend on it.
const MIN_BADGE_MEMBERS = 50;

// Postgres caps a statement at 65535 bind params; ~11 cols/row means we stay
// well under with 2000-row insert chunks.
const INSERT_CHUNK = 2000;

type RatingRow = {
  clan_id: string | number;
  wn7_rated: number;
  wn7_avg: number | null;
  wn8_rated: number;
  wn8_avg: number | null;
  wnx_rated: number;
  wnx_avg: number | null;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  languages: string[] | null;
  members_count: number;
};

type MetricKey = "wn7" | "wn8" | "wnx";
const METRIC_KEYS: MetricKey[] = ["wn7", "wn8", "wnx"];

type InsertValue = ClanRatingsTable["$inferInsert"];

/**
 * Recompute the materialized per-clan ratings for a region (all three metrics
 * in a single scan) and replace the region's `clan_ratings` table. This is the
 * expensive part (~8s: the clan_members x players battle-weighted aggregate)
 * paid once per hour in the background so the by-language boards can serve from
 * a cheap indexed read. The average and rated-member logic mirrors exactly the
 * per-metric SQL in `computeTopClansByMetric` / `getTopClansByLanguage`.
 */
export async function recomputeClanRatings(region: Region): Promise<number> {
  const players = playersByRegion[region];
  const clanMembers = clanMembersByRegion[region];
  const clans = clansByRegion[region];
  const table = clanRatingsByRegion[region];

  // Battle-weighted mean of a metric column over rated members with battles.
  const avg = (col: string) =>
    sql.raw(
      `(SUM(p."${col}" * cm.overall_battles) ` +
        `FILTER (WHERE p."${col}" IS NOT NULL AND cm.overall_battles > 0) ` +
        `/ NULLIF(SUM(cm.overall_battles) ` +
        `FILTER (WHERE p."${col}" IS NOT NULL AND cm.overall_battles > 0), 0)` +
        `)::float8`,
    );

  const rows = (await db.execute(sql`
    WITH clan_stats AS (
      SELECT
        cm.clan_id,
        COUNT(p."wn7")::int AS wn7_rated, ${avg("wn7")} AS wn7_avg,
        COUNT(p."wn8")::int AS wn8_rated, ${avg("wn8")} AS wn8_avg,
        COUNT(p."wnx")::int AS wnx_rated, ${avg("wnx")} AS wnx_avg
      FROM ${clanMembers} cm
      INNER JOIN ${players} p ON p.account_id = cm.account_id
      GROUP BY cm.clan_id
    )
    SELECT
      cs.clan_id,
      cs.wn7_rated, cs.wn7_avg,
      cs.wn8_rated, cs.wn8_avg,
      cs.wnx_rated, cs.wnx_avg,
      c.tag, c.name, c.color, c.emblem, c.languages, c.members_count
    FROM clan_stats cs
    INNER JOIN ${clans} c ON c.id = cs.clan_id
    WHERE c.is_disbanded = false
  `)) as unknown as RatingRow[];

  const values: InsertValue[] = [];
  for (const r of rows) {
    const clanId = Number(r.clan_id);
    for (const metric of METRIC_KEYS) {
      const rated = r[`${metric}_rated`];
      const value = r[`${metric}_avg`];
      if (value == null || rated < MIN_RATED) continue;
      values.push({
        metric,
        clanId,
        tag: r.tag,
        name: r.name,
        color: r.color,
        emblem: r.emblem,
        languages: r.languages ?? [],
        membersCount: r.members_count,
        ratedMembersCount: rated,
        avgValue: value.toString(),
      });
    }
  }

  // Rank per metric, assigned here rather than at read time: this is the one
  // place the whole board is in hand and already comparable, so it costs a sort
  // of what we hold instead of a sort of the table on every badge lookup.
  // Descending, so #1 is the best average. Ties share the lower rank, matching
  // how the board itself displays them.
  //
  // Ranked over `MIN_BADGE_MEMBERS`, not over everything the table holds. The
  // table materializes down to `MIN_RATED` (25) so the language boards, which
  // drop to that floor, have rows to read; the global board a visitor actually
  // sees requires 50. Ranking the whole table would put clans nobody can find
  // on the podium and leave every clan on the real board at rank 4 or worse, so
  // the badge would be simultaneously wrong and invisible. Rows below the floor
  // keep a null rank, which renders no badge.
  for (const metric of METRIC_KEYS) {
    const board = values.filter(
      (v) =>
        v.metric === metric &&
        v.membersCount >= MIN_BADGE_MEMBERS &&
        v.ratedMembersCount >= MIN_BADGE_MEMBERS,
    );
    board.sort((a, b) => Number(b.avgValue) - Number(a.avgValue));
    let rank = 0;
    let previous: string | null = null;
    board.forEach((row, i) => {
      if (row.avgValue !== previous) {
        rank = i + 1;
        previous = row.avgValue;
      }
      row.rank = rank;
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(table);
    for (let i = 0; i < values.length; i += INSERT_CHUNK) {
      await tx.insert(table).values(values.slice(i, i + INSERT_CHUNK));
    }
  });

  return values.length;
}
