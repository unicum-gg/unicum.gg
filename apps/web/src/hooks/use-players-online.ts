"use client";

import { useEffect, useState } from "react";
import type { OnlinePayload } from "@/services/wargaming/wot/server/online";
import type { Region } from "@/services/wargaming/wot";

export function usePlayersOnline(region: Region): OnlinePayload {
  const [payload, setPayload] = useState<OnlinePayload>(null);

  useEffect(() => {
    const es = new EventSource(`/api/${region}/server/online/sse`);
    es.onmessage = (e: MessageEvent<string>) => {
      const next = JSON.parse(e.data) as OnlinePayload;
      // A transient WG failure arrives as `null`. Keep the last known count
      // so the banner never blinks out, rather than clearing it.
      if (next) setPayload(next);
    };
    // Let EventSource auto-reconnect on transient errors instead of closing
    // the stream for good (which would drop the count permanently).
    return () => es.close();
  }, [region]);

  return payload;
}
