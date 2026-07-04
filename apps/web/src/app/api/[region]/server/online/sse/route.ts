import { isRegion, Region } from "@unicum.gg/wargaming/region";
import { fetchPlayersOnline, type OnlinePayload } from "@unicum.gg/core/wargaming/wot/server/online";

export const dynamic = "force-dynamic";

const POLL_MS = 3_000;

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

function ensurePolling(region: Region): void {
  if (globalThis.__wotOnlineIntervals[region]) return;
  const poll = async () => {
    const payload = await fetchPlayersOnline(region);
    // A failed WG tick returns null. Keep the last good value instead of
    // propagating the hole, so connected clients (and any that connect during
    // the outage) never see the count blink out.
    if (!payload) return;
    globalThis.__wotOnlineCache[region] = payload;
    globalThis.__wotOnlineListeners[region]?.forEach((cb) => cb(payload));
  };
  void poll();
  globalThis.__wotOnlineIntervals[region] = setInterval(poll, POLL_MS);
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
  ensurePolling(region);

  const encoder = new TextEncoder();
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

      globalThis.__wotOnlineListeners[region] ??= new Set();
      globalThis.__wotOnlineListeners[region].add(send);

      req.signal.addEventListener("abort", () => {
        globalThis.__wotOnlineListeners[region]?.delete(send);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
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
