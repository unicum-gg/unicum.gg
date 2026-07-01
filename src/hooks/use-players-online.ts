"use client";

import { useEffect, useState } from "react";
import type { OnlinePayload } from "@/services/wargaming/wot/server/online";
import type { Region } from "@/services/wargaming/wot";

export function usePlayersOnline(region: Region): OnlinePayload {
  const [payload, setPayload] = useState<OnlinePayload>(null);

  useEffect(() => {
    const es = new EventSource(`/api/${region}/server/online`);
    es.onmessage = (e: MessageEvent<string>) => {
      setPayload(JSON.parse(e.data) as OnlinePayload);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [region]);

  return payload;
}
