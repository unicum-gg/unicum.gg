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
 *
 * By default it calls `router.refresh()` (re-renders the whole route on the
 * server). Pass `onUpdate` to instead revalidate client-side data (e.g. SWR
 * `mutate`), so only the affected components re-render with no server round-trip.
 */
export function LiveSync({
  url,
  onUpdate,
}: {
  url: string;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKindsRef = useRef<Set<string>>(new Set());
  // Kept in a ref so a changing callback identity doesn't tear down the SSE.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const es = new EventSource(url);
    const handleUpdate = (e: MessageEvent) => {
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
        if (onUpdateRef.current) {
          onUpdateRef.current();
        } else {
          router.refresh();
        }
      }, REFRESH_DEBOUNCE_MS);
    };
    es.addEventListener("update", handleUpdate);
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
