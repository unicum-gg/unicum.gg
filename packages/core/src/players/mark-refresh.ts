import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  MARKS_MIN_BATTLES,
  playerMarksByRegion,
  playersByRegion,
  tankLoadoutsByRegion,
  tankSnapshotsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";
import { bustPlayerDetailCache } from "./detail-cache";
import { writePlayerMarkCounts } from "./mark-counts";
import { fetchPlayerMarksOnGun } from "./marks";

/**
 * How deep into each of the board's rankings the counts are kept current.
 *
 * The board publishes a thousand rows per sort (the total and one per tier), so
 * this is exactly what a reader can see, and nothing past it. Measured on EU on
 * 2026-10-21: the union of those rankings is 3,318 accounts, 1,893 of them had
 * played since their marks were last read, and about 900 play on any given day,
 * which is roughly one portal read every ninety seconds against a pool doing
 * one or two a second. The whole ranked population (70,000 accounts, 28,000
 * stale) would be a day of the portal for rows nobody pages down to.
 */
const BOARD_DEPTH = 1000;

/** How long an account whose read came back empty is left alone. The portal
 * answers nothing on a blip (`fetchPlayerMarksOnGun` fails open), and an
 * account it keeps refusing would otherwise sit at the front of every pass. */
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

const failedUntil = new Map<string, number>();

export type StaleMarkHolder = {
  accountId: number;
  playerId: number;
  nickname: string;
  battles: number;
};

/**
 * The accounts on the Marks of Excellence board whose counts are behind.
 *
 * "Behind" is Wargaming's own `last_battle_at` being newer than our last read
 * of the garage: a mark is scored on battles, so an account that has not played
 * since cannot have moved and is never read twice for nothing. That timestamp
 * is kept fresh by the snapshot pipeline's batched `account/info` check, so the
 * filter costs no Wargaming call at all.
 *
 * Ranked the way the board ranks (the same floor, the same predicates as
 * `getMarksBoard`), across the total AND every tier column, since each column
 * is a ranking a reader can open. Returned best rank first, so a backlog
 * repairs the first page before the tenth.
 */
export async function findStaleMarkHolders(
  region: Region,
  limit: number,
): Promise<StaleMarkHolder[]> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const rows = (await db.execute(sql`
    WITH eligible AS (
      SELECT
        ${marks.accountId} AS account_id,
        ${marks.marks3Total} AS total,
        ${marks.marks3ByTier} AS by_tier,
        ${marks.measuredAt} AS measured_at,
        p.id AS player_id,
        p.nickname,
        p.battles,
        p.last_battle_at
      FROM ${marks}
      INNER JOIN ${players} p ON p.account_id = ${marks.accountId}
      WHERE ${marks.marks3Total} > 0
        AND ${marks.battles} >= ${MARKS_MIN_BATTLES}
        AND p.soft_deleted_at IS NULL
    ),
    ranked AS (
      SELECT account_id, row_number() OVER (ORDER BY total DESC) AS rk
      FROM eligible
      UNION ALL
      SELECT account_id, rk FROM (
        SELECT e.account_id,
          row_number() OVER (
            PARTITION BY tier ORDER BY e.by_tier[tier] DESC, e.total DESC
          ) AS rk
        FROM eligible e, LATERAL generate_subscripts(e.by_tier, 1) AS tier
        WHERE e.by_tier[tier] > 0
      ) per_tier
    ),
    best AS (
      SELECT account_id, MIN(rk) AS rk
      FROM ranked
      WHERE rk <= ${BOARD_DEPTH}
      GROUP BY account_id
    )
    SELECT e.account_id, e.player_id, e.nickname, e.battles
    FROM best b
    INNER JOIN eligible e ON e.account_id = b.account_id
    WHERE e.last_battle_at > e.measured_at
    ORDER BY b.rk, e.measured_at
  `)) as unknown as Array<{
    account_id: number | string;
    player_id: number;
    nickname: string;
    battles: number;
  }>;

  const now = Date.now();
  const out: StaleMarkHolder[] = [];
  for (const r of rows) {
    const accountId = Number(r.account_id);
    if ((failedUntil.get(`${region}:${accountId}`) ?? 0) > now) continue;
    out.push({
      accountId,
      playerId: Number(r.player_id),
      nickname: r.nickname,
      battles: Number(r.battles),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Read one account's marks from the portal and store them everywhere they show.
 *
 * Not a player refresh, deliberately. The refresh path only reads marks when it
 * is the one to discover new battles, and the snapshot pipeline usually got
 * there first: it records the battles WITHOUT marks (carrying the old ones
 * forward), after which a refresh sees nothing new and skips the portal. That
 * is how an account three-marked four guns in a fortnight while its row was
 * refreshed daily. So this asks the portal directly, at one request per account
 * rather than the refresh's handful.
 *
 * Two writes, so the board and the profile cannot disagree: the counts the
 * board ranks, and each vehicle's newest snapshot, which is what the profile's
 * marks column and its tier matrix read. Returns whether the portal answered.
 */
export async function refreshPlayerMarks(
  region: Region,
  holder: StaleMarkHolder,
): Promise<boolean> {
  const marks = await fetchPlayerMarksOnGun(region, holder.accountId);
  const counts = await writePlayerMarkCounts(
    region,
    holder.accountId,
    marks,
    holder.battles,
  );
  if (!counts) {
    failedUntil.set(`${region}:${holder.accountId}`, Date.now() + RETRY_AFTER_MS);
    return false;
  }
  failedUntil.delete(`${region}:${holder.accountId}`);

  const patched = await patchLatestSnapshotMarks(region, holder, marks);
  if (patched > 0) bustPlayerDetailCache(region, holder.nickname);
  return true;
}

/**
 * Overwrite the marks on each vehicle's newest snapshot with what the portal
 * just said, where they differ.
 *
 * The newest row's value was usually carried forward by the bulk pipeline
 * (`carryForwardMarks`) rather than read, so replacing it with a reading is a
 * correction, not a rewrite of history. Newest is the highest battle count, the
 * same tie-break `carryForwardMarks` uses, and the lookup rides the table's
 * primary key `(player_id, tank_id, battles)`.
 *
 * Vehicles the mod reported from the garage are skipped: `applyGarageMarks`
 * ranks that reading above the portal's on every snapshot write, and this must
 * not undo it between two of them.
 */
async function patchLatestSnapshotMarks(
  region: Region,
  holder: StaleMarkHolder,
  marks: Map<number, number>,
): Promise<number> {
  const loadouts = tankLoadoutsByRegion[region];
  const fromGarage = await db
    .select({ tankId: loadouts.tankId })
    .from(loadouts)
    .where(
      and(eq(loadouts.accountId, holder.accountId), isNotNull(loadouts.marks)),
    );
  const skip = new Set(fromGarage.map((r) => Number(r.tankId)));
  const values = [...marks]
    .filter(([tankId]) => !skip.has(tankId))
    .map(([tankId, level]) => sql`(${tankId}::int, ${level}::int)`);
  if (values.length === 0) return 0;

  const snapshots = tankSnapshotsByRegion[region];
  const updated = (await db.execute(sql`
    UPDATE ${snapshots} AS s
    SET marks_on_gun = v.marks
    FROM (VALUES ${sql.join(values, sql`, `)}) AS v(tank_id, marks)
    WHERE s.player_id = ${holder.playerId}
      AND s.tank_id = v.tank_id
      AND s.battles = (
        SELECT MAX(x.battles) FROM ${snapshots} x
        WHERE x.player_id = ${holder.playerId} AND x.tank_id = v.tank_id
      )
      AND s.marks_on_gun IS DISTINCT FROM v.marks
    RETURNING s.tank_id
  `)) as unknown as unknown[];
  return updated.length;
}
