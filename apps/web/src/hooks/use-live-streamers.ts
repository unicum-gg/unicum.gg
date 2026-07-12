"use client";

import useSWR from "swr";
import type { LiveStreamer } from "@unicum.gg/core/twitch/live";
import type { Region } from "@unicum.gg/wargaming/region";

const KEY = "/api/live-streamers";
const REFRESH_MS = 30_000;

/**
 * Currently-live tracked streamers, shared across the whole page via SWR: the
 * home rail and every 🔴 badge key on the same URL, so it's a single deduped
 * poll no matter how many players are on screen. `fallbackData` seeds the SSR
 * render (e.g. the home rail) so it paints without a flash.
 */
export function useLiveStreamers(fallbackData?: LiveStreamer[]): LiveStreamer[] {
  const { data } = useSWR<LiveStreamer[]>(KEY, {
    refreshInterval: REFRESH_MS,
    fallbackData,
  });
  return data ?? [];
}

/** The live stream for a given WoT account, or `undefined` if it's not live. */
export function useLiveStreamer(
  region: Region,
  accountId: number,
): LiveStreamer | undefined {
  const streamers = useLiveStreamers();
  return streamers.find(
    (s) => s.region === region && s.accountId === accountId,
  );
}
