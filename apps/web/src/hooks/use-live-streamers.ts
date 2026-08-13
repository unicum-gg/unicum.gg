"use client";

import { useSyncExternalStore } from "react";
import type { LiveStreamer } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { createSharedStream } from "@/lib/shared-stream";
import STORAGE from "@/constants/storage";
import { unicum } from "@/services/sdk";

// One connection for the whole browser, not just the whole page: the home rail
// and every 🔴 badge read the same snapshot, and so does every other open tab
// (see `createSharedStream` for why that matters). Replaces the old per-page
// SWR poll with a server push, subscribed through the SDK, which parses each
// payload and auto-reconnects on errors.
const stream = createSharedStream<LiveStreamer[]>(
  STORAGE.CHANNELS.STREAMERS_LIVE,
  (emit) => unicum.streamers.live(emit),
);

/**
 * Currently-live tracked streamers, pushed over SSE. `fallbackData` seeds the
 * SSR render (e.g. the home rail) so it paints without a flash and is used until
 * the first server push lands.
 */
export function useLiveStreamers(fallbackData?: LiveStreamer[]): LiveStreamer[] {
  const data = useSyncExternalStore(
    stream.subscribe,
    stream.get,
    () => null,
  );
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
