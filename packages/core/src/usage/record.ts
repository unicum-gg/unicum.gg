import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { usageDaily, userActivityDay, type UsageMetric } from "@unicum.gg/shared";

/** Today as Postgres reads a `date`, in UTC like every other day bucket here. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * The accounts already written for today by this process. Every page view of a
 * signed-in reader asks for the session, so without it the same INSERT would
 * reach Postgres a few dozen times per reader per day. Reset when the day turns,
 * which is also what bounds it: one entry per account seen today.
 */
let seenDay = "";
const seen = new Set<string>();

/**
 * Note that an account was on the site today. Fire and forget: called from the
 * session read, which must never wait on it or fail because of it, so an error
 * is logged and the account is forgotten so the next read tries again.
 */
export function recordUserActivity(userId: string): void {
  const day = utcDay();
  if (day !== seenDay) {
    seenDay = day;
    seen.clear();
  }
  if (seen.has(userId)) return;
  seen.add(userId);
  db.insert(userActivityDay)
    .values({ day, userId })
    .onConflictDoNothing()
    .catch((err: unknown) => {
      seen.delete(userId);
      console.warn("[usage] recording activity failed:", err);
    });
}

/** Add to today's counter for a metric. */
export async function incrementUsage(
  metric: UsageMetric,
  key = "",
  by = 1,
): Promise<void> {
  await db
    .insert(usageDaily)
    .values({ day: utcDay(), metric, key, value: by })
    .onConflictDoUpdate({
      target: [usageDaily.day, usageDaily.metric, usageDaily.key],
      set: { value: sql`${usageDaily.value} + ${by}` },
    });
}

/** Write today's reading of a gauge, replacing any earlier one of the day. */
export async function setUsageGauge(
  metric: UsageMetric,
  value: number,
  key = "",
): Promise<void> {
  await db
    .insert(usageDaily)
    .values({ day: utcDay(), metric, key, value })
    .onConflictDoUpdate({
      target: [usageDaily.day, usageDaily.metric, usageDaily.key],
      set: { value },
    });
}
