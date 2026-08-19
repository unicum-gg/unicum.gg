import { isRegion } from "@unicum.gg/wargaming";
import { assembleTankDetail } from "@unicum.gg/core/wargaming/wot/tanks/detail-assemble";
import {
  getCachedTankDetailJson,
  setCachedTankDetailJson,
} from "@unicum.gg/core/wargaming/wot/tanks/detail-cache";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import { TankDetailResponse } from "./schema.api";

const JSON_HEADERS = { "content-type": "application/json" } as const;

/**
 * Tank detail
 * @description Everything the tank page renders in one payload: identity, top players per rating metric (WN7/WN8/WNX), server-average performance, WN8/WNX expected values, combat specifications, current Marks of Excellence/Mastery with their daily history, and the cheapest research path. `slug` in the response is the canonical slug; callers that reached the tank through a legacy numeric id should redirect to it. Dates are ISO 8601 strings.
 * @pathParams tankParams
 * @response TankDetailResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  return measured("GET /api/{region}/tanks/{slug}/detail", async () => {
    const { region, slug } = await params;
    if (!isRegion(region)) {
      return Response.json({ error: "invalid_region" }, { status: 400 });
    }
    const decoded = decodeURIComponent(slug);

    // Tank detail is static between patches / daily-cron data; serve the whole
    // assembled payload from cache so a navigation isn't a fresh 16-source render.
    const cached = await getCachedTankDetailJson(region, decoded);
    if (cached) return new Response(cached, { headers: JSON_HEADERS });

    // The 16-source assembly is shared with the worker's tank-warm cron (see
    // `detail-assemble`) so the request path and the proactive warm produce the
    // exact same cached shape. Traced so the Server-Timing header separates the
    // assembly (a cache miss) from a bare cache hit.
    const payload = await traced("assembleTankDetail", () =>
      assembleTankDetail(region, decoded),
    );
    if (!payload) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    // Response.json serializes identically; stringify once to both cache and
    // return, keeping jsonResponse's dev-only schema-drift check on the miss.
    const json = JSON.stringify(payload);
    void setCachedTankDetailJson(region, decoded, json);
    if (process.env.NODE_ENV !== "production") {
      jsonResponse(TankDetailResponse, payload);
    }
    return new Response(json, { headers: JSON_HEADERS });
  });
}
