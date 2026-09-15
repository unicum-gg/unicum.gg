import {
  PlayerDetailLiveStatus,
  loadPlayerDetailLive,
} from "@unicum.gg/core/players/detail";
import {
  getCachedPlayerDetailJson,
  setCachedPlayerDetailJson,
} from "@unicum.gg/core/players/detail-cache";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { traced, tracedSync } from "@unicum.gg/core/lib/perf-trace";
import { withDeadline } from "@unicum.gg/core/lib/deadline";
import { isRegion } from "@unicum.gg/wargaming";
import { PlayerDetailResponse } from "./schema.api";

const JSON_HEADERS = { "content-type": "application/json" } as const;

// How long this handler will WAIT for a cold assembly. The work is not
// cancelled: it keeps running and records what it fetched, so the retry this
// answer invites lands on a warm cache.
//
// It exists because the wait is what costs us. On 2026-09-15 a single request
// here ran 1373 seconds holding its payload, which exhausted a worker's V8 heap
// and, worker by worker, took the whole cluster down. Cloudflare cuts the
// connection at 100s regardless, so past that point we were spending memory on
// an answer nobody could receive. 30s is well inside that and well past a
// healthy cold fetch (~1s warm, seconds cold).
const COLD_DEADLINE_MS = 30_000;

/**
 * Player detail
 * @description Full player detail for a region: profile, random-battles totals with 24h/7d/30d period diffs, derived per-tank-breakdown stats (average tier, assistance damages, WN7/WN8/WNX), the tank-by-tank table with all three ratings, the tanks lifting or dragging the overall rating, rating history, clan history, and every non-random game mode's totals. Works for ANY player: cached data is served immediately; on a cold cache the account is resolved on Wargaming, fetched live and recorded (which also starts tracking it). 403 with error "account_locked" when the account exists but Wargaming has locked it (no stats available), 404 only when Wargaming doesn't know the nickname either. Dates are ISO 8601 strings.
 * @pathParams playerLiveParams
 * @response PlayerDetailResponse
 * @tag Players
 * @openapi
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  return measured("GET /api/{region}/players/{nickname}", async () => {
    const { region, nickname } = await params;
    if (!isRegion(region)) {
      return Response.json({ error: "invalid_region" }, { status: 400 });
    }
    const decoded = decodeURIComponent(nickname);

    // The payload is metric-agnostic (liftDrag + ratingHistory carry all three
    // metrics; the client picks the active one), so the cache key is per-player,
    // not per-metric. Short-TTL cache of the serialized payload; a completed
    // refresh busts the key (recordCurrentSnapshot), so it is never staler than
    // the DB.
    const cached = await getCachedPlayerDetailJson(region, decoded);
    if (cached) return new Response(cached, { headers: JSON_HEADERS });

    try {
      // Dates serialize to ISO strings here and are revived client-side by
      // parsing with the shared `PlayerDetailResponse` schema (z.coerce.date).
      // Traced so the Server-Timing header separates the assembly (a cache miss)
      // from a bare cache hit.
      const result = await traced("loadPlayerDetailLive", () =>
        withDeadline(loadPlayerDetailLive(region, decoded), COLD_DEADLINE_MS),
      );
      // Not an error state: the assembly is still running and will store what it
      // fetches. 503 + Retry-After says "ask again", where 504 would read as a
      // dead upstream and 404 would be a lie that the client could cache.
      if (result === null) {
        return Response.json(
          { error: "still_loading" },
          { status: 503, headers: { "retry-after": "5" } },
        );
      }
      if (result.status === PlayerDetailLiveStatus.Unknown) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }
      if (result.status === PlayerDetailLiveStatus.Locked) {
        return Response.json(
          {
            error: "account_locked",
            nickname: result.nickname,
            accountId: result.accountId,
          },
          { status: 403 },
        );
      }
      // Response.json serializes identically; stringify once to both cache and
      // return, keeping jsonResponse's dev-only schema-drift check on the miss.
      const json = tracedSync("serialize", () => JSON.stringify(result.detail));
      void setCachedPlayerDetailJson(region, decoded, json);
      if (process.env.NODE_ENV !== "production") {
        jsonResponse(PlayerDetailResponse, result.detail);
      }
      return new Response(json, { headers: JSON_HEADERS });
    } catch (err) {
      console.error(`[api/${region}/players/${decoded}] failed:`, err);
      return Response.json({ error: "upstream_failure" }, { status: 502 });
    }
  });
}
