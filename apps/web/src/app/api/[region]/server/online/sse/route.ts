import { isRegion, Region } from "@unicum.gg/wargaming";
import { fetchPlayersOnline, type OnlinePayload } from "@unicum.gg/core/wargaming/wot/server/online";

export const dynamic = "force-dynamic";

const POLL_MS = 3_000;
// Keep the connection warm during WG outages (a failed tick sends nothing, so
// the stream can otherwise go silent past the HTTP/3 idle timeout and QUIC
// tears it down with QUIC_NETWORK_IDLE_TIMEOUT). Below the ~30s idle window.
const HEARTBEAT_MS = 25_000;

declare global {
  var __wotOnlineCache: Record<string, OnlinePayload>;
  var __wotOnlineListeners: Record<string, Set<(p: OnlinePayload) => void>>;
  var __wotOnlineIntervals: Record<string, NodeJS.Timeout>;
}

// Clear stale intervals from previous HMR cycles so the new fetchPlayersOnline
// closure takes effect immediately instead of keeping the old one alive.
if (globalThis.__wotOnlineIntervals) {
  Object.values(globalThis.__wotOnlineIntervals).forEach(clearInterval);
}
globalThis.__wotOnlineCache = {};
globalThis.__wotOnlineListeners ??= {};
globalThis.__wotOnlineIntervals = {};

function listenersOf(region: Region): Set<(p: OnlinePayload) => void> {
  return (globalThis.__wotOnlineListeners[region] ??= new Set());
}

/**
 * Start this region's poll unless it is already running.
 *
 * Paired with `stopPollingIfIdle`, and the pairing is the whole point. The
 * interval used to outlive every stream it was started for, the only
 * `clearInterval` on this map being the HMR cleanup above, so the first request
 * for a region on a worker made that worker call Wargaming every POLL_MS for
 * the life of the process, with nobody connected and nothing to hand the
 * payload to. Five PM2 workers across three regions is fifteen such pollers,
 * about five WG calls a second, permanently, against a budget shared with every
 * cron. And `wgn/servers/info` is deliberately absent from the SDK's
 * static-cache allowlist, since it answers the current instant and caching it
 * would defeat the feature, so each of those ticks was a real HTTP call rather
 * than a cache read.
 *
 * The listener set IS the reference count, so the invariant is that an interval
 * exists for a region exactly while a stream is open on it.
 */
function ensurePolling(region: Region): void {
  if (globalThis.__wotOnlineIntervals[region]) return;
  // Skip a tick while the previous poll is still in flight. `setInterval` fires
  // every POLL_MS regardless, so when a poll's WG call is slow (e.g. queued
  // behind the interactive rate-limit lane under budget pressure), un-guarded
  // ticks pile up unbounded acquires and spiral the lane deeper negative. The
  // guard bounds it to one in-flight poll per worker.
  let inFlight = false;
  const poll = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const payload = await fetchPlayersOnline(region);
      // A failed WG tick returns null. Keep the last good value instead of
      // propagating the hole, so connected clients (and any that connect during
      // the outage) never see the count blink out.
      if (!payload) return;
      globalThis.__wotOnlineCache[region] = payload;
      globalThis.__wotOnlineListeners[region]?.forEach((cb) => cb(payload));
    } finally {
      inFlight = false;
    }
  };
  void poll();
  globalThis.__wotOnlineIntervals[region] = setInterval(poll, POLL_MS);
}

/**
 * Stop this region's poll once its last stream has gone.
 *
 * The cached payload is deliberately kept. It is what seeds a connection
 * arriving during a WG outage, which is the case the poll's own null handling
 * exists for, and clearing it here would give that case up to save nothing. The
 * cost is that a value left behind by an idle gap is stale by the length of that
 * gap, which is why `ensurePolling` polls once immediately instead of waiting
 * out its first interval: the reader is seeded from the cache and corrected
 * within one WG round trip.
 */
function stopPollingIfIdle(region: Region): void {
  if (listenersOf(region).size > 0) return;
  const interval = globalThis.__wotOnlineIntervals[region];
  if (!interval) return;
  clearInterval(interval);
  delete globalThis.__wotOnlineIntervals[region];
}

/**
 * Players online stream
 * @description Server-sent events (SSE) of the region's live player count. Each event's data is a JSON object with the region total and the per-server breakdown, pushed whenever the count refreshes (about every 3 seconds).
 * @pathParams regionParams
 * @responseDescription Server-sent event stream of players-online payloads.
 * @tag Server
 * @openapi
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
): Promise<Response> {
  const { region: regionParam } = await params;
  if (!isRegion(regionParam)) return new Response("invalid_region", { status: 400 });
  const region = regionParam;

  const encoder = new TextEncoder();
  let heartbeat: NodeJS.Timeout | null = null;
  // Assigned by `start`, which runs while the stream is being constructed, so
  // it is in place before anything can end the stream.
  let teardown = (): void => {};
  const stream = new ReadableStream({
    start(controller) {
      function send(payload: OnlinePayload) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // controller closed
        }
      }

      if (region in globalThis.__wotOnlineCache) {
        send(globalThis.__wotOnlineCache[region]);
      }

      listenersOf(region).add(send);
      ensurePolling(region);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // closed
        }
      }, HEARTBEAT_MS);

      // Both ways a stream can end have to run this, and either one can be the
      // one that fires: `cancel` is the consumer letting go of the readable, the
      // abort signal is the client going away, and a disconnect can raise both.
      // Removing the listener on the abort path alone left a stream ended
      // through `cancel` with its closure still in the set, called on every tick
      // for the life of the process and throwing into the empty catch above.
      // Guarded so it runs once, because it decides whether the region still has
      // a reader and counting one departure twice would stop a poll the others
      // are still waiting on.
      let gone = false;
      teardown = () => {
        if (gone) return;
        gone = true;
        if (heartbeat) clearInterval(heartbeat);
        listenersOf(region).delete(send);
        stopPollingIfIdle(region);
      };

      req.signal.addEventListener("abort", () => {
        teardown();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
