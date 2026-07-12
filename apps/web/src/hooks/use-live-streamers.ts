"use client";

import { useSyncExternalStore } from "react";
import type { LiveStreamer } from "@unicum.gg/core/twitch/live";
import type { Region } from "@unicum.gg/wargaming/region";

const SSE_URL = "/api/streamers/live/sse";

// One shared SSE connection for the whole page: the home rail and every 🔴 badge
// read the same live snapshot, so there is a single EventSource no matter how
// many are on screen (ref-counted via the listener set; closed when the last
// consumer unmounts). Replaces the old per-page SWR poll with a server push.
let source: EventSource | null = null;
let snapshot: LiveStreamer[] | null = null;
const listeners = new Set<() => void>();

function openConnection(): void {
  if (source || typeof window === "undefined") return;
  source = new EventSource(SSE_URL);
  source.onmessage = (event: MessageEvent<string>) => {
    try {
      snapshot = JSON.parse(event.data) as LiveStreamer[];
    } catch {
      return;
    }
    listeners.forEach((notify) => notify());
  };
  // EventSource auto-reconnects on transient errors, so leave it open.
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  openConnection();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}

function getSnapshot(): LiveStreamer[] | null {
  return snapshot;
}

/**
 * Currently-live tracked streamers, pushed over SSE. `fallbackData` seeds the
 * SSR render (e.g. the home rail) so it paints without a flash and is used until
 * the first server push lands.
 */
export function useLiveStreamers(fallbackData?: LiveStreamer[]): LiveStreamer[] {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return data ?? fallbackData ?? [];
}

/** The live stream for a given WoT account, or `undefined` if it's not live. */
export function useLiveStreamer(
  region: Region,
  accountId: number,
): LiveStreamer | undefined {
  return useLiveStreamers().find(
    (s) => s.region === region && s.accountId === accountId,
  );
}
