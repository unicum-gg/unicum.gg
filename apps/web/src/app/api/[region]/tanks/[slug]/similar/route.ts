import { isRegion } from "@unicum.gg/wargaming";
import { getTankRow } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { getSimilarTanks } from "@unicum.gg/core/wargaming/wot/tanks/similar";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { similarTanks, SIMILAR_DEFAULT_LIMIT } from "./schema.api";
import { SIMILAR_RESULTS_MAX } from "@unicum.gg/shared";

export const dynamic = "force-dynamic";

/**
 * Similar tanks
 * @description The vehicles that play most like this one, best match first. Similarity is the distance between where each vehicle stands among the vehicles of its own tier, read on six aspects (firepower, gun handling, mobility, survivability, concealment, and how the server actually plays it), so a tier VIII and a tier X can be compared. Answers come from within one tier of this vehicle, and from the live game only. 404 if the region's catalogue has no vehicle with this slug.
 * @pathParams tankParams
 * @queryParams similarTanksQuery
 * @response SimilarTanks
 * @tag Tanks
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tanks/{slug}/similar", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const row = await getTankRow(region, decodeURIComponent(slug));
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  // `Number` reads both an absent param (null) and a blank one ("", " ") as 0,
  // which is finite and clamps to a single result. Anything without digits in
  // it is the caller not asking, so it falls through to the default.
  const raw = new URL(req.url).searchParams.get("limit")?.trim();
  const asked = raw ? Number(raw) : Number.NaN;
  const limit = Number.isFinite(asked)
    ? Math.min(SIMILAR_RESULTS_MAX, Math.max(1, Math.trunc(asked)))
    : SIMILAR_DEFAULT_LIMIT;

  const results = await getSimilarTanks(region, row.identity.tankId, limit);
  return jsonResponse(
    similarTanks,
    { results },
    // A day, like the measurement behind it: the catalogue it reads moves when
    // the vehicles cron reparses the client mirror, and the server averages are
    // recomputed nightly.
    { headers: { "cache-control": "public, max-age=86400" } },
  );
}
