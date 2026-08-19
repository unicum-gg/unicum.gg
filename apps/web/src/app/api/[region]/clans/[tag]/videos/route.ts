import { isRegion } from "@unicum.gg/wargaming";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { listClanVideos } from "@unicum.gg/core/tanks/videos-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClanVideosResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Clan videos
 * @description Every published battle this clan is credited on, newest approved first: the tactics it called and the maps it called them on. A submitter names the clan when suggesting a competitive battle, and it is stored as an id rather than a tag, so a rename never strands the credit. Empty for a clan nobody has credited yet.
 * @pathParams clanLiveParams
 * @response ClanVideosResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/videos", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const clan = await getClanByTagCached(region, decodeURIComponent(tag));
  if (!clan) return Response.json({ error: "not_found" }, { status: 404 });

  const videos = await listClanVideos(region, clan.info.id);
  return jsonResponse(
    ClanVideosResponse,
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
