"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REFRESH_DEBOUNCE_MS = 500;

/**
 * Opens an SSE connection to the given URL and triggers `router.refresh()`
 * whenever a server-side refresh signal arrives. Multiple signals within
 * `REFRESH_DEBOUNCE_MS` collapse into a single refresh.
 */
export function LiveSync({ url }: { url: string }) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource(url);
    const triggerRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };
    es.addEventListener("update", triggerRefresh);
    es.onerror = () => {
      // EventSource auto-reconnects with backoff. Nothing to do.
    };
    return () => {
      es.close();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, router]);

  return null;
}
