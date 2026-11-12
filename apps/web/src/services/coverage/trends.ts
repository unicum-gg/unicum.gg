import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import { coverageTrendsByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** One day of a dense 30-day series: every day in the window is present, with
 * a zero for the days the query returned no row for. */
export type DailyPoint = { day: string; count: number };

export const DAYS_WINDOW = 30;

export function buildDaySeries(
  rows: { day: string; count: string }[],
  days: number,
): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = r.day.slice(0, 10);
    byDay.set(key, Number(r.count));
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

// The three player_snapshots aggregates with no cheap `players`-table proxy (a
// rolling 24h count and two 30-day daily histograms, the per-player MIN(taken_at)
// CTE being the ~24s heaviest) are full seq-scans of a 10M+ row table. Rather
// than run them here — where a cold cache let a thundering herd fire several
// concurrent scans and saturate the shared host's CPU/IO — they are precomputed
// hourly by the coverage-trends cron (@unicum.gg/core/coverage/trends-aggregate)
// into the singleton `${region}_coverage_trends` row, and this reads that one
// cheap row. It deliberately does NOT fall back to the scan when the row is
// missing (that would reinstate the very herd this removes); the cron's
// boot-time seed keeps the cold window short. `buildDaySeries` still runs here so
// the dense 30-day window re-anchors to the current UTC day, keeping the output
// byte-for-byte identical.
async function getSnapshotTrendsUncached(region: Region): Promise<{
  playerSnapshotsLast24h: number;
  playerSnapshotsDaily: DailyPoint[];
  firstSnapshotsDaily: DailyPoint[];
}> {
  const row = (
    await db.select().from(coverageTrendsByRegion[region]).limit(1)
  )[0];
  if (!row) {
    return {
      playerSnapshotsLast24h: 0,
      playerSnapshotsDaily: buildDaySeries([], DAYS_WINDOW),
      firstSnapshotsDaily: buildDaySeries([], DAYS_WINDOW),
    };
  }
  return {
    playerSnapshotsLast24h: Number(row.playerSnapshotsLast24h),
    playerSnapshotsDaily: buildDaySeries(row.playerSnapshotsDaily, DAYS_WINDOW),
    firstSnapshotsDaily: buildDaySeries(row.firstSnapshotsDaily, DAYS_WINDOW),
  };
}

export const getSnapshotTrends = unstable_cache(
  getSnapshotTrendsUncached,
  ["coverage-snapshot-trends"],
  { revalidate: 3600, tags: ["coverage"] },
);
