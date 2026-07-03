import { EventEmitter } from "node:events";
import { getRedisPubSub } from "@/services/redis";

/**
 * Pub/sub for live updates (LiveSync SSE).
 *
 * A local `EventEmitter` always does the handler dispatch. When Redis is
 * configured (see services/redis) a `publish` goes out over Redis and the
 * subscriber connection re-emits incoming messages onto that emitter, so an
 * update on one process (e.g. the cron worker) reaches subscribers on every
 * other (the web instances serving SSE). Without Redis it's a plain in-process
 * emitter — single process, no external dependency (local dev).
 *
 * `subscribe`/`publish` stay identical for callers. Everything hangs off
 * `globalThis` so Next.js's repeated module evaluation shares one instance.
 */

type Handler = (data: unknown) => void;

declare global {
  var __liveEmitter: EventEmitter | undefined;
  var __liveSubRefs: Map<string, number> | undefined;
  var __liveSubWired: boolean | undefined;
}

function getEmitter(): EventEmitter {
  if (!globalThis.__liveEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalThis.__liveEmitter = emitter;
  }
  return globalThis.__liveEmitter;
}

function getRefs(): Map<string, number> {
  if (!globalThis.__liveSubRefs) globalThis.__liveSubRefs = new Map();
  return globalThis.__liveSubRefs;
}

// Returns the Redis connections (or null in dev), wiring the subscriber's
// message handler onto the local emitter exactly once.
function redisBackend() {
  const conns = getRedisPubSub();
  if (!conns) return null;
  if (!globalThis.__liveSubWired) {
    conns.subscriber.on("message", (channel, message) => {
      let data: unknown = null;
      try {
        data = message ? JSON.parse(message) : null;
      } catch {
        data = null;
      }
      getEmitter().emit(channel, data);
    });
    globalThis.__liveSubWired = true;
  }
  return conns;
}

export function publish(channel: string, data: unknown = null): void {
  const conns = redisBackend();
  if (conns) {
    void conns.publisher
      .publish(channel, JSON.stringify(data ?? null))
      .catch((err) => console.error("[live] publish failed:", err));
    return;
  }
  getEmitter().emit(channel, data);
}

export function subscribe(channel: string, handler: Handler): () => void {
  const emitter = getEmitter();
  emitter.on(channel, handler);

  const conns = redisBackend();
  if (conns) {
    const refs = getRefs();
    const next = (refs.get(channel) ?? 0) + 1;
    refs.set(channel, next);
    if (next === 1) {
      void conns.subscriber
        .subscribe(channel)
        .catch((err) => console.error("[live] subscribe failed:", err));
    }
  }

  return () => {
    emitter.off(channel, handler);
    if (conns) {
      const refs = getRefs();
      const remaining = (refs.get(channel) ?? 1) - 1;
      if (remaining <= 0) {
        refs.delete(channel);
        void conns.subscriber.unsubscribe(channel).catch(() => {});
      } else {
        refs.set(channel, remaining);
      }
    }
  };
}

export function clanChannel(region: string, clanId: number): string {
  return `clan:${region}:${clanId}`;
}

export function playerChannel(region: string, accountId: number): string {
  return `player:${region}:${accountId}`;
}
