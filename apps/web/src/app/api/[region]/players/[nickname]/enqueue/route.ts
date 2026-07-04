import { eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { playerRefreshQueueByRegion, playersByRegion } from "@/services/db/schema";
import { enqueuePlayerRefresh } from "@/services/players/refresh-queue";
import { isRegion } from "@unicum.gg/wargaming/region";

const LIVE_PRIORITY = 20;
const BATCH_SIZE = 25;
const TICK_SECONDS = 10;
const WG_CALLS_PER_PLAYER = 3; // getPlayerInfo + getTanksStats + getAccountWTR
const WG_RPS: Record<string, number> = { eu: 6, na: 8, asia: 8 };

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
  await enqueuePlayerRefresh(region, [Number(player.accountId)], { priority: LIVE_PRIORITY });

  const queue = playerRefreshQueueByRegion[region];
  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(queue)
    .where(eq(queue.priority, LIVE_PRIORITY));

  const position = Math.max(0, (countRow?.count ?? 1) - 1);
  const rps = WG_RPS[region] ?? 6;
  const positionInBatch = position % BATCH_SIZE;
  const batchIndex = Math.floor(position / BATCH_SIZE);
  // Players ahead of us in the same batch consume rate-limiter tokens first
  const rateWait = Math.ceil((positionInBatch * WG_CALLS_PER_PLAYER) / rps);
  const selfWait = Math.ceil(WG_CALLS_PER_PLAYER / rps);
  const estimatedSeconds = (batchIndex + 1) * TICK_SECONDS + rateWait + selfWait;

  return Response.json({ estimatedSeconds });
}
