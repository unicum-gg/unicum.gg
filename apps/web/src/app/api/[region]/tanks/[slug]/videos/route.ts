import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { listTankVideos } from "@unicum.gg/core/tanks/videos-read";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { TankVideosResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tank videos
 * @description Community-suggested gameplay videos for one tank, newest approved first. Each entry is a battle rather than a whole video: it carries the second it starts at, so a three-hour stream VOD can be linked at the minute this tank is played. The map, mode and result are declared by the submitter and checked in moderation; the spawn direction is derived from the map's own geometry. Region-independent, the same list is served on every region. Suggesting one is a write, and lives on `/videos/suggest`.
 * @pathParams tankParams
 * @response TankVideosResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const videos = await listTankVideos(region, tank.tankId);
  return jsonResponse(
    TankVideosResponse,
    { videos },
    {
      // Cached by a CDN, revalidated by the browser. A held browser copy is
      // actively wrong here: the submitter of a queued row watches it turn
      // from "waiting on a moderator" into a published one, and their own
      // queue is uncached, so a stale list makes the row vanish at the exact
      // moment it goes live. `s-maxage` keeps the shared cache doing its job.
      headers: {
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
