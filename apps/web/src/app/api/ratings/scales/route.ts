import { ratingScales } from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import { RatingScalesResponse } from "./schema.api";
import { measured } from "@/services/perf";

// Stated rather than inferred, like every sibling under app/api. The body is
// derived from the code and never from a request, but leaving it implicit makes
// it eligible for prerender into the shared ISR store and freezes its
// Server-Timing header on the build machine.
export const dynamic = "force-dynamic";

/**
 * Rating colour scales
 * @description Every colour scale the site paints a number with: the three rating metrics, random and Steel Hunter and Stronghold win rates, the Steel Hunter ratings, the two Stronghold ratings and the community star rating. Each is a list of half-open bands with the colour's name and its hex. Region-less, because a threshold is the same on every server, and static, because it only moves when the site's own scale does. Fetch it once and paint from it rather than re-implementing the ladder, which is what makes a client drift the day a threshold changes.
 * @response RatingScalesResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /ratings/scales", () => GET__perf(...args));
}
async function GET__perf() {
  return jsonResponse(
    RatingScalesResponse,
    { scales: ratingScales() },
    {
      // Derived from the code itself, so it can only change with a deploy.
      // Cached hard for that reason, and a caller reading it once at startup is
      // the intended use rather than a concession.
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
