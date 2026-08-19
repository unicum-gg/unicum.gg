import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { listPendingVideosFor } from "@unicum.gg/core/tanks/videos-read";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { MyVideosResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * My queued videos
 * @description The signed-in user's own suggestions that are still waiting on a moderator, wherever they were filed. Their own only: an unreviewed row is shown to the person waiting on it and to nobody else, which is also why this answers with an empty list rather than an error when signed out. Uncached for the same reason, unlike the published lists beside it. Not scoped to one tank or map: the page that renders it keeps the rows it is about.
 * @pathParams regionParams
 * @response MyVideosResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/videos/mine", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const noStore = { headers: { "cache-control": "no-store" } };
  if (!session?.user) {
    return jsonResponse(MyVideosResponse, { videos: [] }, noStore);
  }

  const videos = await listPendingVideosFor(region, session.user.id);
  return jsonResponse(MyVideosResponse, { videos }, noStore);
}
