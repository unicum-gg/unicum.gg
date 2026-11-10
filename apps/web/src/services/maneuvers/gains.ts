import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  maneuversClanHistoryByRegion,
  maneuversPlayerHistoryByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Region } from "@unicum.gg/wargaming";

/** The window a gain is measured over. */
const GAIN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Where each listed player and clan stood 24 hours ago, keyed by id: its Fame
 * Points and its place then, which the board turns into a gain and a move.
 *
 * The source publishes cumulative Fame Points and nothing else, so a gain
 * exists only as the difference between two instants we recorded. The
 * baseline is each row's last capture at or before the newest capture less a
 * day; a row with no capture by then joined the board since and gained all it
 * holds. Null when the edition's captures do not reach back a day, since every
 * gain would then be measured over a shorter window than the column says.
 *
 * Asked for the listed ids only, one backward index probe each on the history
 * primary key, rather than over the whole edition: the history grows by one
 * row per ranked entry every capture, and a scan of it would cost more with
 * every day the edition runs.
 */
export async function readGains(
  region: Region,
  eventName: string,
  accountIds: number[],
  clanIds: number[],
): Promise<{
  players: Map<number, Baseline>;
  clans: Map<number, Baseline>;
} | null> {
  const snapshots = maneuversSnapshotsByRegion[region];
  const [[latest], [first]] = await Promise.all([
    db
      .select({ at: snapshots.capturedAt })
      .from(snapshots)
      .where(eq(snapshots.eventName, eventName))
      .orderBy(desc(snapshots.capturedAt))
      .limit(1),
    db
      .select({ at: snapshots.capturedAt })
      .from(snapshots)
      .where(eq(snapshots.eventName, eventName))
      .orderBy(snapshots.capturedAt)
      .limit(1),
  ]);
  if (!latest || !first) return null;
  const cut = new Date(latest.at.getTime() - GAIN_WINDOW_MS);
  if (first.at > cut) return null;

  // The capture the baseline is read at, so every row is measured from the
  // same instant rather than from whenever it last moved.
  const [baseline] = await db
    .select({ at: snapshots.capturedAt })
    .from(snapshots)
    .where(and(eq(snapshots.eventName, eventName), lte(snapshots.capturedAt, cut)))
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);
  if (!baseline) return null;

  const playerHistory = maneuversPlayerHistoryByRegion[region];
  const clanHistory = maneuversClanHistoryByRegion[region];
  const [playerRows, clanRows] = await Promise.all([
    baselinePoints(playerHistory, playerHistory.accountId, eventName, accountIds, baseline.at),
    baselinePoints(clanHistory, clanHistory.clanId, eventName, clanIds, baseline.at),
  ]);
  return { players: playerRows, clans: clanRows };
}

export type Baseline = { famePoints: number; place: number };

type HistoryTable =
  | (typeof maneuversPlayerHistoryByRegion)[Region]
  | (typeof maneuversClanHistoryByRegion)[Region];

/** Each id's Fame Points and place at `at`, read off its last capture at or
 * before it. */
async function baselinePoints(
  table: HistoryTable,
  idColumn: AnyPgColumn,
  eventName: string,
  ids: number[],
  at: Date,
): Promise<Map<number, Baseline>> {
  if (ids.length === 0) return new Map();
  const rows = await db.execute<{ id: string; fame_points: string; place: number }>(sql`
    select ids.id, h.fame_points, h.place
    from unnest(${`{${ids.join(",")}}`}::bigint[]) as ids(id)
    cross join lateral (
      select ${table.famePoints} as fame_points, ${table.place} as place
      from ${table}
      where ${table.eventName} = ${eventName}
        and ${idColumn} = ids.id
        and ${table.capturedAt} <= ${at.toISOString()}
      order by ${table.capturedAt} desc
      limit 1
    ) h
  `);
  return new Map(
    rows.map((r) => [
      Number(r.id),
      { famePoints: Number(r.fame_points), place: Number(r.place) },
    ]),
  );
}
