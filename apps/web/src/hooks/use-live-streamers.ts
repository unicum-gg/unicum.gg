"use client";

import { useSyncExternalStore } from "react";
import type { LiveStreamer } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { unicum } from "@/services/sdk";

// One shared SSE connection for the whole page: the home rail and every 🔴 badge
// read the same live snapshot, so there is a single stream no matter how many
// are on screen (ref-counted via the listener set; closed when the last consumer
// unmounts). Replaces the old per-page SWR poll with a server push, subscribed
// through the SDK (which parses each payload and auto-reconnects on errors).
let unsubscribe: (() => void) | null = null;
let snapshot: LiveStreamer[] | null = null;
const listeners = new Set<() => void>();

function openConnection(): void {
  if (unsubscribe || typeof window === "undefined") return;
  unsubscribe = unicum.streamers.live((streamers) => {
    snapshot = streamers;
    listeners.forEach((notify) => notify());
  });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  openConnection();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
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
