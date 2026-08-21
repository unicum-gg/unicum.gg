import { bigint, jsonb, pgTable, smallint, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/** One raw histogram bucket, exactly as the daily-growth queries group it
 * (`date_trunc('day', ...)` + `COUNT(*)::text`). Stored sparse/verbatim so the
 * read path's `buildDaySeries` re-anchors the dense 30-day window to the current
 * UTC day at render time, keeping /coverage's output byte-for-byte the same. */
export type CoverageDayBucket = { day: string; count: string };

// Materialized /coverage snapshot trends, ONE singleton row per region. The
// three source aggregates are full seq-scans of the 10M+ row *_player_snapshots
// tables (a rolling 24h count + two 30-day daily histograms, the per-player
// MIN(taken_at) CTE being the ~24s heaviest). Run on the request path they had
// no cheap proxy and, under a cold cache, a thundering herd fired several
// concurrent scans that saturated the shared host's CPU/IO. The coverage-trends
// cron recomputes this row hourly (off-peak minute), so /coverage reads one
// cheap row instead of scanning. Singleton per region (`id = 1`): the read
// fetches the whole region's payload, so unlike the leaderboard tables it needs
// no board index and no per-entity rows.
export function makeCoverageTrendsTable(region: string) {
  return pgTable(`${region}_coverage_trends`, {
    // Pins the table to a single row per region.
    id: smallint("id").primaryKey().default(1),
    // Rolling 24h snapshot count (the `activity.playerSnapshotsLast24h` figure).
    playerSnapshotsLast24h: bigint("player_snapshots_last24h", {
      mode: "number",
    }).notNull(),
    // Raw grouped rows of the daily snapshot-growth histogram.
    playerSnapshotsDaily: jsonb("player_snapshots_daily")
      .$type<CoverageDayBucket[]>()
      .notNull(),
    // Raw grouped rows of the per-player first-snapshot histogram.
    firstSnapshotsDaily: jsonb("first_snapshots_daily")
      .$type<CoverageDayBucket[]>()
      .notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type CoverageTrendsTable = ReturnType<typeof makeCoverageTrendsTable>;

export const coverageTrendsByRegion: Record<Region, CoverageTrendsTable> = {
  [Region.EU]: makeCoverageTrendsTable(Region.EU),
  [Region.NA]: makeCoverageTrendsTable(Region.NA),
  [Region.ASIA]: makeCoverageTrendsTable(Region.ASIA),
};
