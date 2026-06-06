import { Agent } from "undici";

/**
 * Dedicated undici Agent for portal calls (`*.wargaming.net/clans/*`).
 *
 * G-Core (the CDN in front of the portals) occasionally drops idle TCP
 * sockets silently — no RST, no close — so undici keeps them in the pool
 * as "alive". The next request reuses a dead socket, waits for a reply
 * that never comes, and trips AbortSignal.timeout at 30s. `withRetries`
 * then burns 5 more attempts (260s+ total) before giving up, by which
 * point the whole portal queue is starved. A process restart clears it.
 *
 * The defaults below shorten that failure mode without touching the rate
 * limiter or retry logic:
 *
 * - `keepAliveTimeout: 1_000` — recycle idle sockets after 1s instead of
 *   undici's default 4s, so zombies surface (and get replaced with a
 *   fresh TCP+TLS handshake) much sooner. The portal is happy with a new
 *   handshake every second; we don't need the optimization.
 * - `connections: 4` — cap concurrent connections per origin. With our
 *   1 RPS portal limit, 4 is plenty of headroom and gives the pool more
 *   rotation pressure (one stuck socket = at most 1 out of 4 lanes
 *   blocked, vs the default 100 where the pool can fill with zombies).
 * - `pipelining: 0` — disable HTTP/1.1 pipelining. Pipelining lets a
 *   single socket hold N in-flight requests; if that socket dies, all N
 *   stall behind the same dead connection. We trade slightly higher
 *   socket churn for "one dead socket = one dead request".
 *
 * One Agent shared across regions: undici auto-partitions its pools per
 * origin (eu.wargaming.net, na.wargaming.net, asia.wargaming.net are
 * three independent pools internally).
 */
let portalDispatcher: Agent | null = null;

export function getPortalDispatcher(): Agent {
  if (!portalDispatcher) {
    portalDispatcher = new Agent({
      keepAliveTimeout: 1_000,
      connections: 4,
      pipelining: 0,
    });
  }
  return portalDispatcher;
}
