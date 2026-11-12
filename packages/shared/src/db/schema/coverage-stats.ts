import { jsonb, pgTable, smallint, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Materialized /coverage payload, ONE singleton row per region, holding the
// whole answer the page renders rather than its parts.
//
// It exists because the hourly `unstable_cache` that used to hold it could not.
// That entry lived in the shared ISR Redis, which runs `allkeys-lru` at a 2 GiB
// ceiling with a key cap, so it was evicted well inside its hour: the eight
// full-table aggregates behind it (COUNT/MIN/MAX/SUM over ~2M-row `*_players`
// plus two clan tables) were measured running 1,578 times a day against the 24
// the window promised, which is 19% of the whole database's time over 55 days.
// A cache that is evicted is not a slow cache, it is no cache, and the figures
// it guards are too expensive to recompute on a miss. A row in Postgres is
// never evicted, which is the entire reason this is a table and not a key.
//
// The payload is stored whole, as the shape the service already round-tripped
// through JSON (the read path's `toDate` revives the three timestamps inside
// it). Storing the parts would mean a column per figure and a migration per
// addition, for a blob nothing queries by field.
export function makeCoverageStatsTable(region: string) {
  return pgTable(`${region}_coverage_stats`, {
    // Pins the table to a single row per region.
    id: smallint("id").primaryKey().default(1),
    // The whole `CoverageStats` object, serialized. Typed `unknown` here on
    // purpose: the shape belongs to the service that builds it, and shared must
    // not import it.
    payload: jsonb("payload").$type<unknown>().notNull(),
    // When the figures in `payload` were actually measured. This is what the
    // page prints, so it must never be stamped before the work is done.
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The refresh lease, kept apart from `computed_at` for exactly that reason.
    // Five web workers read this row, so without it each one would start its own
    // recompute on the same expiry and fire five concurrent sets of scans, which
    // is the stampede the old cache had no defence against either. A claim that
    // dies mid-flight is retried once this goes stale.
    refreshStartedAt: timestamp("refresh_started_at", { withTimezone: true }),
  });
}

export type CoverageStatsTable = ReturnType<typeof makeCoverageStatsTable>;

export const coverageStatsByRegion: Record<Region, CoverageStatsTable> = {
  [Region.EU]: makeCoverageStatsTable(Region.EU),
  [Region.NA]: makeCoverageStatsTable(Region.NA),
  [Region.ASIA]: makeCoverageStatsTable(Region.ASIA),
};
