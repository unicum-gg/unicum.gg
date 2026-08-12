import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { listPendingVideosFor } from "@unicum.gg/core/tanks/videos";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { MyTankVideosResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * My queued videos
 * @description The signed-in user's own suggestions for this tank that are still waiting on a moderator. Their own only: an unreviewed row is shown to the person waiting on it and to nobody else, which is also why this answers with an empty list rather than an error when signed out. Uncached for the same reason, unlike the published list beside it.
 * @pathParams tankParams
 * @response MyTankVideosResponse
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

  const session = await auth.api.getSession({ headers: await headers() });
  const empty = { videos: [] };
  if (!session?.user) {
    return jsonResponse(MyTankVideosResponse, empty, {
      headers: { "cache-control": "no-store" },
    });
  }

  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const videos = await listPendingVideosFor(region, tank.tankId, session.user.id);
  return jsonResponse(
    MyTankVideosResponse,
    { videos },
    { headers: { "cache-control": "no-store" } },
  );
}
