"use client";

import { useSyncExternalStore } from "react";
import type { OnlinePayload } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { createSharedStream, type SharedStream } from "@/lib/shared-stream";
import STORAGE from "@/constants/storage";
import { unicum } from "@/services/sdk";

// One stream per region, shared by every tab of this browser (see
// `createSharedStream`). A transient Wargaming failure arrives as `null` and is
// dropped rather than published, so the banner keeps the last known count
// instead of blinking out.
const byRegion = new Map<Region, SharedStream<NonNullable<OnlinePayload>>>();

function streamFor(region: Region): SharedStream<NonNullable<OnlinePayload>> {
  let stream = byRegion.get(region);
  if (!stream) {
    stream = createSharedStream(STORAGE.CHANNELS.SERVER_ONLINE(region), (emit) =>
      unicum
        .region(region)
        .server.online((next) => {
          if (next) emit(next);
        }),
    );
    byRegion.set(region, stream);
  }
  return stream;
}

/**
 * How many players are on this region's servers.
 *
 * Keyed by region rather than kept in one slot: switching region resubscribes,
 * and a single slot would either blink to nothing on every reconnect or, since
 * a failed frame is dropped, keep showing the previous region's number for
 * good. A stream per region also settles the race where a frame from the old
 * subscription lands after the switch, since it is published on the stream
 * nobody is reading any more.
 */
export function usePlayersOnline(region: Region): OnlinePayload {
  const stream = streamFor(region);
  return useSyncExternalStore(stream.subscribe, stream.get, () => null);
}
