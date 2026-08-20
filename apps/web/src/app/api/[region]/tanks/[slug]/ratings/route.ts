import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getTankRatingSummary } from "@unicum.gg/core/tanks/ratings-read";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { TankRatingsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Tank community rating
 * @description What players think of one vehicle, and what that opinion is worth. Unlike every other community average, a vote here can only be cast by an account that has actually taken the tank into battle, and each vote carries the voter's own record on it, so the response splits the verdict by how well the voters play and by which server they play on, alongside the star histograms and the optional per-axis radar. `hype` is the gap between where the community ranks the tank in its tier and where its measured win rate ranks it: positive means overrated, negative underrated. Region-independent, the same verdict is served everywhere; the region in the path only resolves the slug.
 * @pathParams tankParams
 * @response TankRatingsResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/ratings", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const summary = await getTankRatingSummary(tank.tankId);
  return jsonResponse(TankRatingsResponse, summary, {
    // Short and shared-only, for the same reason the videos list is: someone
    // who has just voted reloads to see their star land in the histogram, and a
    // held browser copy would show them the count from before they pressed it.
    // The CDN still absorbs the traffic of everyone who did not vote.
    headers: {
      "cache-control":
        "public, max-age=0, s-maxage=120, stale-while-revalidate=60",
    },
  });
}
