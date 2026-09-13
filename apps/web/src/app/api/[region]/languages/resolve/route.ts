import { MAX_IDS_PER_KIND, resolveLanguages } from "@unicum.gg/core/languages";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { countedNumericIds } from "@/services/openapi/id-list";
import { LanguagesResolveResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Resolve languages by id
 * @description Languages and flags for a set of account ids and clan ids, in one call. Each list is optional and comma separated, capped at 100 ids, and a longer list is refused rather than truncated. A clan answers with the set its owner declared; a player answers from the same duration-weighted inference over their clan history the player page shows, falling back to their current clan's declared set only when we hold no history at all, and `source` says which. `countries` carries the flag code per language, aligned index for index. An id we hold no language for is absent from the response. Reads cached data only, with no live Wargaming call.
 * @pathParams regionParams
 * @queryParams languagesResolveQuery
 * @response LanguagesResolveResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/languages/resolve", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const query = new URL(req.url).searchParams;
  const players = countedNumericIds(query, "players");
  const clans = countedNumericIds(query, "clans");

  // Judged on what was WRITTEN, not on what parsed, and refused rather than
  // truncated. Both halves serve the same contract: an absent id has to mean
  // "we hold no language for it". Truncating silently, or counting after the
  // malformed entries were dropped, would let a cut list answer 200 and read
  // exactly like a roster we know nothing about.
  if (players.sent > MAX_IDS_PER_KIND || clans.sent > MAX_IDS_PER_KIND) {
    return Response.json(
      { error: "too_many_ids", max: MAX_IDS_PER_KIND },
      { status: 400 },
    );
  }

  const resolved = await resolveLanguages(region, {
    players: players.ids,
    clans: clans.ids,
  });

  return jsonResponse(LanguagesResolveResponse, resolved, {
    // The same answer for every caller, unlike the per-reader `search/resolve`
    // next door, so it belongs in a shared cache. A declared set moves only
    // when a clan owner edits it and an inferred one at most hourly, so an hour
    // at the edge is well inside the data's own cadence, and a mod polling a
    // roster between battles re-asks the identical URL.
    headers: {
      "cache-control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
