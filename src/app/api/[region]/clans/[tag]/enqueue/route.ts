import { eq } from "drizzle-orm";
import { db } from "@/services/db";
import { clansByRegion } from "@/services/db/schema";
import { enqueueClanRefresh } from "@/services/clans/refresh-queue";
import { isRegion } from "@/services/wargaming/wot";

/**
 * Enqueue clan refresh
 * @description Signals that a real browser is viewing this clan's page. Schedules a background refresh of the clan's data from the Wargaming API. Idempotent: calling it multiple times only raises the existing queue entry's priority, never duplicates work.
 * @pathParams clanLiveParams
 * @responseDescription Refresh enqueued. No body.
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
  await enqueueClanRefresh(region, [Number(row.id)], { priority: 10 });
  return new Response(null, { status: 204 });
}
