import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRefreshQueueByRegion, playersByRegion } from "@unicum.gg/shared";
import {
  LIVE_REFRESH_PRIORITY,
  enqueuePlayerRefresh,
} from "@unicum.gg/core/players/refresh-queue";
import { getRefreshLatencyMs } from "@unicum.gg/core/players/refresh-metrics";
import { isRegion } from "@unicum.gg/wargaming";

// Each refresh fans out to WG (account/info, tanks/stats, WTR, clan history);
// used for the per-player marginal cost of anyone ahead, and for the cold-start
// fallback before any measured latency exists.
const WG_CALLS_PER_PLAYER = 4;
const WG_RPS: Record<string, number> = { eu: 6, na: 8, asia: 8 };
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
  await enqueuePlayerRefresh(region, [accountId], {
    priority: LIVE_REFRESH_PRIORITY,
  });

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
  const baseMs = (await getRefreshLatencyMs(region)) ?? FALLBACK_LATENCY_MS;
  // Marginal cost of each player genuinely ahead of us right now (rare: the
  // cron drains 25/s, so the live queue almost never has depth). One player's
  // WG calls' worth of rate-limiter time.
  const marginalMs = (WG_CALLS_PER_PLAYER / (WG_RPS[region] ?? 6)) * 1000;

  const estimatedSeconds = Math.min(
    MAX_ETA_SECONDS,
    Math.max(MIN_ETA_SECONDS, Math.round((baseMs + ahead * marginalMs) / 1000)),
  );

  return Response.json({ estimatedSeconds });
}
