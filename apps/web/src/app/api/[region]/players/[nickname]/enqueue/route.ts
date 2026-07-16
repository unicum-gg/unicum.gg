import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRefreshQueueByRegion, playersByRegion } from "@unicum.gg/shared";
import { enqueuePlayerRefresh } from "@unicum.gg/core/players/refresh-queue";
import { getRefreshThroughput } from "@unicum.gg/core/players/refresh-metrics";
import { isRegion } from "@unicum.gg/wargaming";

const LIVE_PRIORITY = 20;
// Each refresh fans out to WG (account/info, tanks/stats, WTR, clan history);
// only used as the cold-start fallback rate before the measured throughput has
// any recent completions to report.
const WG_CALLS_PER_PLAYER = 4;
const WG_RPS: Record<string, number> = { eu: 6, na: 8, asia: 8 };
// Wall time between a snapshot landing and the browser showing it: LiveSync
// publish, SSE hop, SWR refetch. Added on top of the queue drain time.
const PROPAGATION_SECONDS = 2;
// The estimate can never credibly beat the in-flight refresh + propagation, and
// past ~2min a countdown stops being useful, so we clamp both ends.
const MIN_ETA_SECONDS = 3;
const MAX_ETA_SECONDS = 120;
// Guard the division: if the measured throughput ever reads absurdly low we'd
// project a runaway ETA. This is the slowest per-player rate we'll model.
const MIN_THROUGHPUT = 0.2;

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
  await enqueuePlayerRefresh(region, [accountId], { priority: LIVE_PRIORITY });

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

  // Measured live-refresh throughput (players/sec) folds in the rate limiter,
  // G-Core throttling, retries and backfill contention. Cold start falls back
  // to the theoretical per-region ceiling.
  const measured = await getRefreshThroughput(region);
  const fallback = (WG_RPS[region] ?? 6) / WG_CALLS_PER_PLAYER;
  const throughput = Math.max(MIN_THROUGHPUT, measured ?? fallback);

  // Time for the (ahead + our own) refreshes to complete at that rate, plus the
  // propagation hop, clamped to a credible range.
  const drainSeconds = (ahead + 1) / throughput;
  const estimatedSeconds = Math.min(
    MAX_ETA_SECONDS,
    Math.max(MIN_ETA_SECONDS, Math.round(drainSeconds + PROPAGATION_SECONDS)),
  );

  return Response.json({ estimatedSeconds });
}
