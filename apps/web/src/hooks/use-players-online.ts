"use client";

import { useEffect, useState } from "react";
import type { OnlinePayload } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { unicum } from "@/services/sdk";

export function usePlayersOnline(region: Region): OnlinePayload {
  // The count is stored with the region it was measured for, and read back only
  // when the two still agree. "Keep the last known count" (below) has to hold
  // WITHIN a region, never across one: switching region resubscribes but cannot
  // clear the count from the effect without blinking the banner on every
  // reconnect, so the previous region's number would stay on screen until the
  // new stream delivered — and, since a `null` frame is ignored, would stay
  // there for good whenever the new region's first frame was a WG failure.
  // Tagging also settles the race where a frame from the old subscription lands
  // after the switch: it is written under the old region and never read.
  const [state, setState] = useState<{ region: Region; payload: OnlinePayload }>({
    region,
    payload: null,
  });

  useEffect(() => {
    // SSE via the SDK. A transient WG failure arrives as `null`; keep the last
    // known count so the banner never blinks out, rather than clearing it.
    // EventSource auto-reconnects on transient errors (the SDK leaves it open).
    return unicum.region(region).server.online((next) => {
      if (next) setState({ region, payload: next });
    });
  }, [region]);

  return state.region === region ? state.payload : null;
}
