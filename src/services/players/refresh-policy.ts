import { type AnyColumn, type SQL, sql } from "drizzle-orm";

/**
 * Activity buckets keyed on `players.last_battle_at`. Used by the snapshot
 * cron (to decide who is due) and by /coverage (to report on-time rates).
 *
 * `Unfetched` is special: `last_battle_at IS NULL` means we know the
 * account exists (discovered via clan walk) but never called
 * `/wot/account/info/` to populate its stats. These are real players with
 * real history (sampled 100 random EU, 99 had battles, 80 had 1000+).
 * They get top priority — see `refreshCutoffSql` and the cron ORDER BY.
 */
export enum ActivityBucket {
  Unfetched = "unfetched",
  Active24h = "active_24h",
  Active7d = "active_7d",
  Recent30d = "recent_30d",
  Recent90d = "recent_90d",
  Dormant1y = "dormant_1y",
  Inactive = "inactive",
}

export const ACTIVITY_BUCKET_ORDER: readonly ActivityBucket[] = [
  ActivityBucket.Unfetched,
  ActivityBucket.Active24h,
  ActivityBucket.Active7d,
  ActivityBucket.Recent30d,
  ActivityBucket.Recent90d,
  ActivityBucket.Dormant1y,
  ActivityBucket.Inactive,
];

export const ACTIVITY_BUCKET_LABEL: Record<ActivityBucket, string> = {
  [ActivityBucket.Unfetched]: "Awaiting first snapshot",
  [ActivityBucket.Active24h]: "Active < 24h",
  [ActivityBucket.Active7d]: "Active < 7d",
  [ActivityBucket.Recent30d]: "Recent < 30d",
  [ActivityBucket.Recent90d]: "Recent < 90d",
  [ActivityBucket.Dormant1y]: "Dormant < 1y",
  [ActivityBucket.Inactive]: "Inactive > 1y",
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Per-bucket target time between two refreshes. Tuned to keep total
 * refresh volume under the WG API rate limit while staying fresh on
 * accounts anyone looks at. `Unfetched = 0` is a sentinel meaning "always
 * due, top priority" — the cron picks them every tick until the queue
 * drains.
 */
export const REFRESH_CADENCE_MS: Record<ActivityBucket, number> = {
  [ActivityBucket.Unfetched]: 0,
  [ActivityBucket.Active24h]: 6 * HOUR_MS,
  [ActivityBucket.Active7d]: 24 * HOUR_MS,
  [ActivityBucket.Recent30d]: 3 * DAY_MS,
  [ActivityBucket.Recent90d]: 7 * DAY_MS,
  [ActivityBucket.Dormant1y]: 30 * DAY_MS,
  [ActivityBucket.Inactive]: 90 * DAY_MS,
};

export function formatCadence(ms: number): string {
  if (ms === 0) return "ASAP";
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
  return `${Math.round(ms / DAY_MS)}d`;
}

/**
 * SQL CASE that resolves to the refresh cutoff for the given last-battle
 * column. A row is "due for refresh" when its `last_seen_at` is older than
 * this value.
 *
 * For Unfetched (`last_battle_at IS NULL`) we return `NOW() + 1 day`, which
 * is always strictly greater than any current `last_seen_at` — so the WHERE
 * `last_seen_at < cutoff` always matches and the row is perpetually due.
 *
 * Same thresholds as REFRESH_CADENCE_MS; both must move together.
 */
export function refreshCutoffSql(lastBattle: AnyColumn): SQL {
  return sql`CASE
    WHEN ${lastBattle} IS NULL THEN NOW() + INTERVAL '1 day'
    WHEN ${lastBattle} > NOW() - INTERVAL '24 hours' THEN NOW() - INTERVAL '6 hours'
    WHEN ${lastBattle} > NOW() - INTERVAL '7 days' THEN NOW() - INTERVAL '24 hours'
    WHEN ${lastBattle} > NOW() - INTERVAL '30 days' THEN NOW() - INTERVAL '3 days'
    WHEN ${lastBattle} > NOW() - INTERVAL '90 days' THEN NOW() - INTERVAL '7 days'
    WHEN ${lastBattle} > NOW() - INTERVAL '365 days' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '90 days'
  END`;
}

/**
 * SQL CASE that resolves to the `ActivityBucket` string for the given
 * last-battle column. Use to GROUP BY bucket in reporting queries.
 */
export function activityBucketSql(lastBattle: AnyColumn): SQL {
  return sql`CASE
    WHEN ${lastBattle} IS NULL THEN ${ActivityBucket.Unfetched}
    WHEN ${lastBattle} > NOW() - INTERVAL '24 hours' THEN ${ActivityBucket.Active24h}
    WHEN ${lastBattle} > NOW() - INTERVAL '7 days' THEN ${ActivityBucket.Active7d}
    WHEN ${lastBattle} > NOW() - INTERVAL '30 days' THEN ${ActivityBucket.Recent30d}
    WHEN ${lastBattle} > NOW() - INTERVAL '90 days' THEN ${ActivityBucket.Recent90d}
    WHEN ${lastBattle} > NOW() - INTERVAL '365 days' THEN ${ActivityBucket.Dormant1y}
    ELSE ${ActivityBucket.Inactive}
  END`;
}
