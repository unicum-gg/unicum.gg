"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const REFRESH_DEBOUNCE_MS = 500;

type UpdatePayload = { kind?: string };

const TOAST_BY_KIND: Record<string, string> = {
  info: "Clan info updated",
  members: "Members list updated",
  events: "Recent activity updated",
  snapshot: "Stats updated",
};

/**
 * Opens an SSE connection to the given URL and triggers `router.refresh()`
 * whenever a server-side refresh signal arrives. Multiple signals within
 * `REFRESH_DEBOUNCE_MS` collapse into a single refresh + a single toast.
 */
export function LiveSync({ url }: { url: string }) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKindsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource(url);
    const onUpdate = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as UpdatePayload;
        if (payload.kind) pendingKindsRef.current.add(payload.kind);
      } catch {
        // ignore malformed payloads
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const kinds = Array.from(pendingKindsRef.current);
        pendingKindsRef.current.clear();
        const message =
          kinds.length === 1
            ? (TOAST_BY_KIND[kinds[0]] ?? "Data updated")
            : "Live update";
        toast.success(message, { duration: 3000 });
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };
    es.addEventListener("update", onUpdate);
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
