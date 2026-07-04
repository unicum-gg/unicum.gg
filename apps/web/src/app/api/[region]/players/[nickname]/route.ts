import { ratingMetricFromCookie } from "@/constants/rating";
import { loadPlayerDetail } from "@/services/players/detail";
import { isRegion } from "@unicum.gg/wargaming/region";

/**
 * Player detail
 * @description Full player detail for a region: profile, random-battles totals with 24h/7d/30d period diffs, derived per-tank-breakdown stats (average tier, assistance damages, WN7/WN8/WNX), the tank-by-tank table with all three ratings, the tanks lifting or dragging the overall rating, rating history, clan history, and every non-random game mode's totals. Serves the tracker's cached data; a player unknown to the tracker returns 404. Dates are ISO 8601 strings.
 * @pathParams playerLiveParams
 * @queryParams playerDetailQuery
 * @response PlayerDetailResponse
 * @tag Players
 * @openapi
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);
  // Caller may pin a metric via ?metric=wn7|wn8|wnx; otherwise default. The
  // metric drives `liftDrag` and `ratingHistory` (vehicle rows and the derived
  // grid always carry all three ratings).
  const url = new URL(req.url);
  const metric = ratingMetricFromCookie(url.searchParams.get("metric"));

  try {
    // Dates serialize to ISO strings here and are revived client-side by
    // parsing with the shared `PlayerDetailResponse` schema (z.coerce.date).
    const data = await loadPlayerDetail(region, decoded, metric);
    if (!data) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json(data);
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
