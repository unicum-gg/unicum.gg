import { isRegion } from "@unicum.gg/wargaming";
import { assembleTankCompare } from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import {
  getCachedTankCompareJson,
  setCachedTankCompareJson,
} from "@unicum.gg/core/wargaming/wot/tanks/compare-cache";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { MAX_COMPARE_TANKS, MIN_COMPARE_TANKS } from "@/constants/compare";
import { TanksCompareResponse } from "./schema.api";

const JSON_HEADERS = { "content-type": "application/json" } as const;

/** The vehicles a query asks for: deduped before the ceiling applies, so a
 * repeated slug costs itself its slot rather than a distinct vehicle further
 * along. Already URL-decoded by `searchParams`. */
function resolveSlugs(raw: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const slug = part.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length === MAX_COMPARE_TANKS) break;
  }
  return out;
}

/**
 * Compare tanks
 * @description Everything a side-by-side comparison of 2 to 4 vehicles renders (`?slugs=is-7,e-100`): each vehicle's specifications, module combinations, equipment slots, crew and progression, plus its server-average performance. The mountable catalogues (equipment, directives, consumables, crew skills) are hoisted out of the vehicles and described once under `catalog`, referenced by key, and `ranges` carries the catalogue-wide spread of every characteristic so a client can score a vehicle per category. Duplicate slugs collapse; a slug the catalogue doesn't know is dropped rather than failing the request, as long as two vehicles remain.
 * @pathParams regionParams
 * @queryParams compareSlugsQuery
 * @response TanksCompareResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/compare", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const slugs = resolveSlugs(new URL(req.url).searchParams.get("slugs"));
  if (slugs.length < MIN_COMPARE_TANKS) {
    return Response.json({ error: "missing_slugs" }, { status: 400 });
  }

  // A comparison is as static between patches as a tank page is, and costs
  // several times more to assemble, so the whole serialized payload is cached
  // (see `compare-cache`). Without it every navigation onto a `force-dynamic`
  // /vs page re-runs the full assembly.
  const cached = await getCachedTankCompareJson(region, slugs);
  if (cached) return new Response(cached, { headers: JSON_HEADERS });

  const payload = await assembleTankCompare(region, slugs);
  if (payload.vehicles.length < MIN_COMPARE_TANKS) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Response.json serializes identically; stringify once to both cache and
  // return, keeping jsonResponse's dev-only schema-drift check on the miss.
  const json = JSON.stringify(payload);
  void setCachedTankCompareJson(region, slugs, json);
  if (process.env.NODE_ENV !== "production") {
    jsonResponse(TanksCompareResponse, payload);
  }
  return new Response(json, {
    headers: { ...JSON_HEADERS, "cache-control": "public, max-age=600" },
  });
}
