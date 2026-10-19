import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRefreshQueueByRegion, playersByRegion } from "@unicum.gg/shared";
import {
  LIVE_REFRESH_PRIORITY,
  enqueuePlayerRefresh,
} from "@unicum.gg/core/players/refresh-queue";
import {
  RefreshSubject,
  getRefreshLatencyMs,
} from "@unicum.gg/core/refresh-metrics";
import { isRegion } from "@unicum.gg/wargaming";

// Players the live lane drains per second, which is what the wait of anyone
// ahead is actually paced by.
//
// NOT the WG API's rate. A live refresh reads marks on gun through the clan
// portal, and that pool is 1 rps per region divided across the egress lanes
// (`DEFAULT_PORTAL_RPS` in @unicum.gg/wargaming), so EU's two lanes allow 2.00/s
// and measured 2.07/s on 2026-10-19. The earlier arithmetic here used the WG
// API's 6 rps over 4 calls, claiming 1.5 players/s, and the comment below it
// claimed the cron drained 25/s: both are an order of magnitude out, so this
// endpoint reported "3 to 120 seconds" to readers whose real wait was 43 HOURS
// while the lane held 140,595 entries. Deriving the figure from the pool that
// actually gates the call is what keeps the countdown honest.
const LANE_DRAIN_RPS: Record<string, number> = { eu: 2, na: 2, asia: 2 };
// Cold-start / quiet-region fallback: a plausible end-to-end latency (ms) when
// the p75 metric has no recent live-refresh sample to report.
const FALLBACK_LATENCY_MS = 4_000;
// A countdown below the in-flight refresh + propagation isn't credible, and
// past ~2min it stops being useful, so we clamp both ends.
const MIN_ETA_SECONDS = 3;
const MAX_ETA_SECONDS = 120;

/**
 * Enqueue player refresh
 * @description Signals that a real browser is viewing this player's page. Schedules a background refresh of the player's stats from the Wargaming API. Idempotent: calling it multiple times only raises the existing queue entry's priority, never duplicates work.
 * @pathParams playerLiveParams
 * @responseDescription Estimated seconds until the refresh completes.
 * @tag Players
 * @openapi
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return new Response("invalid_region", { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);
  const players = playersByRegion[region];
  const [player] = await db
    .select({ accountId: players.accountId })
    .from(players)
    .where(sql`LOWER(${players.nickname}) = LOWER(${decoded})`)
    .limit(1);
  if (!player) {
    return new Response("not_found", { status: 404 });
  }
  const accountId = Number(player.accountId);
  const enqueued = await enqueuePlayerRefresh(region, [accountId], {
    priority: LIVE_REFRESH_PRIORITY,
  });
  // The lane is bounded (see LIVE_QUEUE_MAX), so a view can arrive to a full
  // one. Say so rather than inventing a countdown: the page is already serving
  // the data we hold, and `snapshot-pipeline` refreshes this player on its own
  // cadence without going through the portal.
  if (enqueued.admitted === 0 && enqueued.bumped === 0) {
    return Response.json({ estimatedSeconds: null, queued: false });
  }

  const queue = playerRefreshQueueByRegion[region];
  // Read back OUR entry: enqueue keeps the earliest queued_at (LEAST), so our
  // real position may differ from "just now" if the player was already queued.
  const [self] = await db
    .select({ priority: queue.priority, queuedAt: queue.queuedAt })
    .from(queue)
    .where(eq(queue.accountId, accountId))
    .limit(1);

  // Players the cron drains before us: strictly higher priority, or same
  // priority but queued earlier (ORDER BY priority DESC, queued_at ASC).
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

  // Measured p75 processing time of a recent live refresh: one signal that
  // already folds in WG/G-Core latency, rate-limiter contention from the
  // backfill cron and retries. Cold start / quiet region falls back to a
  // plausible flat latency.
  const baseMs =
    (await getRefreshLatencyMs(RefreshSubject.Player, region)) ??
    FALLBACK_LATENCY_MS;
  // Marginal cost of each player genuinely ahead of us. The lane is bounded at
  // LIVE_QUEUE_MAX, so this term is bounded too: at 2/s that is two minutes at
  // the very back, which is exactly MAX_ETA_SECONDS.
  const marginalMs = 1000 / (LANE_DRAIN_RPS[region] ?? 2);

  const estimatedSeconds = Math.min(
    MAX_ETA_SECONDS,
    Math.max(MIN_ETA_SECONDS, Math.round((baseMs + ahead * marginalMs) / 1000)),
  );

  return Response.json({ estimatedSeconds, queued: true });
}
