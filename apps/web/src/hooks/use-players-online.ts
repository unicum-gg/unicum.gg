"use client";

import { useEffect, useState } from "react";
import type { OnlinePayload } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { unicum } from "@/services/sdk";

export function usePlayersOnline(region: Region): OnlinePayload {
  const [payload, setPayload] = useState<OnlinePayload>(null);

  useEffect(() => {
    // SSE via the SDK. A transient WG failure arrives as `null`; keep the last
    // known count so the banner never blinks out, rather than clearing it.
    // EventSource auto-reconnects on transient errors (the SDK leaves it open).
    return unicum.region(region).server.online((next) => {
      if (next) setPayload(next);
    });
  }, [region]);

  return payload;
}
