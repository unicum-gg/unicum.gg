import type { Region } from "@unicum.gg/wargaming";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Short-TTL Redis cache of the fully-serialized player-detail JSON response.
 *
 * Why: link-following crawlers re-hit a small set of player pages continuously
 * across all regions, and the detail endpoint has no payload cache — every hit
 * replays the whole query set (player CTE + name-history + tank `DISTINCT ON`
 * over all history + subscription + clan history) and decodes hundreds of wide
 * rows on the single render thread. Measured in prod: that flood alone pins the
 * web JS thread at ~1.2 cores with essentially no real traffic.
 *
 * The TTL is only a safety net. Freshness comes from {@link bustPlayerDetailCache},
 * called wherever a fresh snapshot is committed (`recordCurrentSnapshot`), so a
 * completed refresh — background pipeline, on-demand cron, or cold-DB live fetch
 * — makes the new data visible on the very next request instead of after expiry.
 * That fires on the same event as the LiveSync publish, so the cache and the SSE
 * push stay in lockstep.
 */
export const PLAYER_DETAIL_TTL_SECONDS = 60;

function key(region: Region, nickname: string): string {
  return `pdetail:${region}:${nickname.toLowerCase()}`;
}

/** Cached JSON body for this (region, nickname), or null on miss / no Redis. The
 * payload is metric-agnostic, so there is a single entry per player. */
export async function getCachedPlayerDetailJson(
  region: Region,
  nickname: string,
): Promise<string | null> {
  // Dev-only escape hatch for the endpoint speed bench: force a miss so the
  // handler actually assembles the payload (measuring its real cost with the
  // sub-caches still warm), instead of returning a cache hit. Never set in prod.
  if (process.env.PERF_BYPASS_PAYLOAD_CACHE === "1") return null;
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key(region, nickname));
  } catch {
    return null; // fail open: a Redis blip degrades to "no cache", never an error
  }
}

/** Store the serialized detail JSON. Best-effort. */
export async function setCachedPlayerDetailJson(
  region: Region,
  nickname: string,
  json: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key(region, nickname), json, "EX", PLAYER_DETAIL_TTL_SECONDS);
  } catch {
    // ignore — caching is best-effort
  }
}

/**
 * Invalidate a player's cached detail. Call this whenever a fresh snapshot is
 * committed so a refresh becomes visible immediately. Fire-and-forget and
 * fail-open: a delete failure just leaves the (TTL-bounded) stale entry.
 */
export function bustPlayerDetailCache(region: Region, nickname: string): void {
  const redis = getRedisClient();
  if (!redis) return;
  void redis.del(key(region, nickname)).catch(() => {});
}

/**
 * Assemblies running in THIS process, keyed exactly as the cache above is.
 *
 * WHY. `withDeadline` bounds how long a caller waits and deliberately does not
 * cancel the work, which is right: the assembly records what it fetched, so the
 * retry it invites lands on warm data. What was missing is that nothing joined
 * those retries to the assembly already running, and nothing published its
 * payload once every caller had walked away. Both halves failed together on
 * 2026-10-27, and the shape is worth keeping because it is self-amplifying.
 *
 * Measured over five minutes of the incident: 13,651 `still_loading` answers,
 * 45 a second, against 13,421 completed assemblies whose median was 30,125 ms,
 * which is the deadline to the millisecond. So essentially every request gave
 * up, answered 503 with `retry-after: 5`, and the client came back five seconds
 * later to start a SECOND assembly of the same player, then a third. Each one
 * kept running and kept holding its payload, so the orphans accrued at the rate
 * of the retries and never at the rate anything drained them. Worker RSS grew
 * about 10 MiB a second, PM2 killed each worker at its 3,400 MiB threshold
 * every three and a half minutes, and a restarted worker is cold, which made
 * the next death arrive sooner.
 *
 * The second half is what kept it from ever recovering. The payload cache was
 * written by the HANDLER, so an assembly that outran the deadline had its
 * result discarded by the one piece of code that would have published it: the
 * work was done, nobody stored it, and the next request assembled it again. A
 * 60-second cache in front of a 90-second assembly is a cache that can never
 * hold anything.
 *
 * So the assembly is now shared and publishes itself. A second caller for a
 * player already being assembled attaches to it instead of starting another,
 * and the payload reaches Redis when the work lands rather than when a caller
 * is still there to receive it. The dedup is per process, so a cluster of N
 * workers can still run N assemblies of one player: that is a ceiling where
 * there was none, and the published payload closes the rest, since the next
 * request finds it warm whichever worker it reaches.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Assemble a player's detail at most once per process at a time, publishing the
 * serialized payload to the shared cache as soon as it lands.
 *
 * `serialize` returns null for a result that must not be cached (an unknown or
 * locked account), and its string is handed back so the caller that is still
 * waiting does not serialize the same payload a second time.
 */
export function assemblePlayerDetailOnce<T>(
  region: Region,
  nickname: string,
  assemble: () => Promise<T>,
  serialize: (result: T) => string | null,
): Promise<{ result: T; json: string | null }> {
  const cacheKey = key(region, nickname);
  const pending = inFlight.get(cacheKey) as
    | Promise<{ result: T; json: string | null }>
    | undefined;
  if (pending) return pending;

  const promise = assemble()
    .then((result) => {
      const json = serialize(result);
      if (json !== null) void setCachedPlayerDetailJson(region, nickname, json);
      return { result, json };
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}
