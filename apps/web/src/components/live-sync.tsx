"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { LiveUpdate, Unsubscribe } from "@unicum.gg/sdk";

const REFRESH_DEBOUNCE_MS = 500;

const TOAST_BY_KIND: Record<string, string> = {
  info: "Clan info updated",
  members: "Members list updated",
  events: "Recent activity updated",
  snapshot: "Stats updated",
};

/**
 * Subscribes to a live SSE stream through the SDK and triggers a refresh
 * whenever an update signal arrives. Multiple signals within
 * `REFRESH_DEBOUNCE_MS` collapse into a single refresh + a single toast.
 *
 * `subscribe` comes from the SDK (e.g. `(cb) => unicum.region(r).clans(tag).live(cb)`)
 * and must be stable (memoize it so it only changes when the target stream does,
 * otherwise the SSE reconnects on every render).
 *
 * By default it calls `router.refresh()` (re-renders the whole route on the
 * server). Pass `onUpdate` to instead revalidate client-side data (e.g. SWR
 * `mutate`), so only the affected components re-render with no server round-trip.
 */
export function LiveSync({
  subscribe,
  onUpdate,
}: {
  subscribe: (onUpdate: (event: LiveUpdate) => void) => Unsubscribe;
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
    const unsubscribe = subscribe((payload) => {
      if (payload.kind) pendingKindsRef.current.add(payload.kind);
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
    });
    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subscribe, router]);

  return null;
}
