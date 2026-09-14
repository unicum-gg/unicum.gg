import { MAX_IDS_PER_KIND, resolveEntities } from "@unicum.gg/core/resolve";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { countedNumericIds, idList } from "@/services/openapi/id-list";
import { ResolveResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Resolve a roster
 * @description Everything about a set of players and clans in one call: language flags, lifetime and 30-day ratings, win rates, and the clan a player wears. Addressed by the ids a game client hands over, plus clan tags for the one roster that carries no id. Each list is optional, comma separated and capped at 100; a longer list is refused rather than truncated. An id we hold nothing for is absent from the response, while an entity we hold but have no language for is present with an empty `languages`. Reads cached data only, with no live Wargaming call.
 * @pathParams regionParams
 * @queryParams resolveQuery
 * @response ResolveResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/resolve", () => GET__perf(...args));
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
  const tags = idList(query, "tags");

  // Judged on what was WRITTEN and refused rather than truncated, both in
  // service of the same contract: an absent id has to mean "we hold nothing for
  // it". Truncating silently, or counting after the malformed entries were
  // dropped, would let a cut list answer 200 and read like an unknown roster.
  if (
    players.sent > MAX_IDS_PER_KIND ||
    clans.sent > MAX_IDS_PER_KIND ||
    tags.length > MAX_IDS_PER_KIND
  ) {
    return Response.json(
      { error: "too_many_ids", max: MAX_IDS_PER_KIND },
      { status: 400 },
    );
  }

  const resolved = await resolveEntities(region, {
    players: players.ids,
    clans: clans.ids,
    tags,
  });

  return jsonResponse(ResolveResponse, resolved, {
    // Shorter than the languages lookup this replaces, because ratings move
    // with every crawl while a declared language moves when a clan owner edits
    // it. The window is what a roster is worth re-reading over, not what the
    // slowest field could bear.
    headers: {
      "cache-control":
        "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
