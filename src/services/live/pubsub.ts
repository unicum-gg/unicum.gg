import { EventEmitter } from "node:events";

/**
 * In-memory pub/sub for live updates. Single-process only.
 * For multi-instance deployments, swap this for Redis pub/sub.
 *
 * The emitter is hung off globalThis so Next.js dev mode (which can load
 * the same module twice — once for instrumentation, once for route handlers)
 * still shares one instance. Publishers and subscribers would otherwise sit
 * on different emitters and never see each other's events.
 */

type Handler = (data: unknown) => void;

declare global {
  var __liveEmitter: EventEmitter | undefined;
}

function getEmitter(): EventEmitter {
  if (!globalThis.__liveEmitter) {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    globalThis.__liveEmitter = e;
  }
  return globalThis.__liveEmitter;
}

export function publish(channel: string, data: unknown = null): void {
  getEmitter().emit(channel, data);
}

export function subscribe(channel: string, handler: Handler): () => void {
  const e = getEmitter();
  e.on(channel, handler);
  return () => e.off(channel, handler);
}

export function clanChannel(region: string, clanId: number): string {
  return `clan:${region}:${clanId}`;
}

export function playerChannel(region: string, accountId: number): string {
  return `player:${region}:${accountId}`;
}
