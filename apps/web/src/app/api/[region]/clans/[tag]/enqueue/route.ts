import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clanRefreshQueueByRegion, clansByRegion } from "@unicum.gg/shared";
import {
  LIVE_CLAN_REFRESH_PRIORITY,
  enqueueClanRefresh,
} from "@unicum.gg/core/clans/refresh-queue";
import {
  RefreshSubject,
  getRefreshLatencyMs,
} from "@unicum.gg/core/refresh-metrics";
import { isRegion } from "@unicum.gg/wargaming";

// Cold-start / quiet-region fallback: a plausible clan refresh latency (ms)
// when the p75 metric has no recent sample. Clans are slower than players
// (portal member/event calls + stronghold + global map, portal rate-limited),
// hence higher than the player fallback.
const CLAN_FALLBACK_LATENCY_MS = 6_000;
// Marginal cost of each clan genuinely ahead of us right now (rare: the cron
// drains a batch per second, so the live queue almost never has depth).
const CLAN_MARGINAL_MS = 2_000;
const MIN_ETA_SECONDS = 3;
const MAX_ETA_SECONDS = 120;

/**
 * Enqueue clan refresh
 * @description Signals that a real browser is viewing this clan's page. Schedules a background refresh of the clan's data from the Wargaming API. Idempotent: calling it multiple times only raises the existing queue entry's priority, never duplicates work.
 * @pathParams clanLiveParams
 * @responseDescription Estimated seconds until the refresh completes.
 * @tag Clans
 * @openapi
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return new Response("invalid_region", { status: 400 });
  }
  const decoded = decodeURIComponent(tag).toLowerCase();
  const clans = clansByRegion[region];
  const [row] = await db
    .select({ id: clans.id })
    .from(clans)
    .where(eq(clans.tagLower, decoded))
    .limit(1);
  if (!row) {
    return new Response("not_found", { status: 404 });
  }
  const clanId = Number(row.id);
  await enqueueClanRefresh(region, [clanId], {
    priority: LIVE_CLAN_REFRESH_PRIORITY,
  });

  const queue = clanRefreshQueueByRegion[region];
  // Read back OUR entry: enqueue keeps the earliest queued_at (LEAST), so our
  // real position may differ from "just now" if the clan was already queued.
  const [self] = await db
    .select({ priority: queue.priority, queuedAt: queue.queuedAt })
    .from(queue)
    .where(eq(queue.clanId, clanId))
    .limit(1);

  // Clans the cron drains before us: strictly higher priority, or same priority
  // but queued earlier (ORDER BY priority DESC, queued_at ASC).
  let ahead = 0;
  if (self) {
    const [aheadRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(queue)
      .where(
        or(
          sql`${queue.priority} > ${self.priority}`,
          and(
            eq(queue.priority, self.priority),
            lt(queue.queuedAt, self.queuedAt),
          ),
        ),
      );
    ahead = aheadRow?.count ?? 0;
  }

  // Measured p75 processing time of a recent live clan refresh: one signal that
  // already folds in portal/G-Core latency, rate-limiter contention and
  // retries. Cold start / quiet region falls back to a plausible flat latency.
  const baseMs =
    (await getRefreshLatencyMs(RefreshSubject.Clan, region)) ??
    CLAN_FALLBACK_LATENCY_MS;

  const estimatedSeconds = Math.min(
    MAX_ETA_SECONDS,
    Math.max(
      MIN_ETA_SECONDS,
      Math.round((baseMs + ahead * CLAN_MARGINAL_MS) / 1000),
    ),
  );

  return Response.json({ estimatedSeconds });
}
