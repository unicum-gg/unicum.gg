import { subscribe } from "@unicum.gg/core/live/pubsub";
import type { LiveStreamer } from "@unicum.gg/shared";
import { LIVE_STREAMERS_CHANNEL } from "@unicum.gg/core/twitch/live-poller";

export const dynamic = "force-dynamic";

type Send = (streamers: LiveStreamer[]) => void;

declare global {
  var __liveStreamersLast: LiveStreamer[] | undefined;
  var __liveStreamersSends: Set<Send> | undefined;
  var __liveStreamersWired: boolean | undefined;
}

// Wire the LiveSync subscription lazily, on the first request, and NEVER at
// module load. A module-level Redis `subscribe()` runs while `next build`
// evaluates this route: it opens a connection to the internal Redis (unreachable
// from the build container), ioredis retries forever, and the static-generation
// worker never exits, hanging the build. Doing it from `GET` keeps it at request
// time only. One subscription per process, fanned out to every open stream: the
// single poller (in the cron process) publishes a snapshot every few seconds,
// this receives it (over Redis in prod, in-process in dev), caches it so a new
// connection is served immediately, and pushes it to all connected browsers.
function ensureWired(): Set<Send> {
  const sends = (globalThis.__liveStreamersSends ??= new Set<Send>());
  if (!globalThis.__liveStreamersWired) {
    globalThis.__liveStreamersWired = true;
    subscribe(LIVE_STREAMERS_CHANNEL, (data) => {
      const streamers = (data as LiveStreamer[] | null) ?? [];
      globalThis.__liveStreamersLast = streamers;
      globalThis.__liveStreamersSends?.forEach((send) => send(streamers));
    });
  }
  return sends;
}

/**
 * Live streamers stream
 * @description Server-sent events (SSE) of the tracked players currently live on Twitch in the World of Tanks category across all regions, ranked by WNX and pushed every few seconds. Each event's `data` is the same JSON array as `GET /api/streamers/live`.
 * @responseDescription Server-sent event stream of live-streamer arrays.
 * @tag Streamers
 * @openapi
 */
export function GET(req: Request): Response {
  const sends = ensureWired();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send: Send = (streamers) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(streamers)}\n\n`),
          );
        } catch {
          // controller closed
        }
      };

      // Seed the connection with the latest snapshot right away.
      if (globalThis.__liveStreamersLast) send(globalThis.__liveStreamersLast);
      sends.add(send);

      req.signal.addEventListener("abort", () => {
        sends.delete(send);
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
