import {
  PlayerDetailLiveStatus,
  loadPlayerDetailLive,
} from "@unicum.gg/core/players/detail";
import {
  getCachedPlayerDetailJson,
  setCachedPlayerDetailJson,
} from "@unicum.gg/core/players/detail-cache";
import { jsonResponse } from "@/services/openapi/json-response";
import { isRegion } from "@unicum.gg/wargaming";
import { PlayerDetailResponse } from "./schema.api";

const JSON_HEADERS = { "content-type": "application/json" } as const;

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
    const result = await loadPlayerDetailLive(region, decoded);
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
    const json = JSON.stringify(result.detail);
    void setCachedPlayerDetailJson(region, decoded, json);
    if (process.env.NODE_ENV !== "production") {
      jsonResponse(PlayerDetailResponse, result.detail);
    }
    return new Response(json, { headers: JSON_HEADERS });
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
