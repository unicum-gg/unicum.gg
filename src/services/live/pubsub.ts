import { EventEmitter } from "node:events";

/**
 * In-memory pub/sub for live updates. Single-process only.
 * For multi-instance deployments, swap this for Redis pub/sub.
 */

type Handler = (data: unknown) => void;

const emitter = new EventEmitter();
// Node defaults to 10 listeners which is too low when many clients are connected.
emitter.setMaxListeners(0);

export function publish(channel: string, data: unknown = null): void {
  emitter.emit(channel, data);
}

export function subscribe(channel: string, handler: Handler): () => void {
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}

export function clanChannel(region: string, clanId: number): string {
  return `clan:${region}:${clanId}`;
}

export function playerChannel(region: string, accountId: number): string {
  return `player:${region}:${accountId}`;
}
