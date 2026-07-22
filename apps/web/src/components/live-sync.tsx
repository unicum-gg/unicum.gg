"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { LiveUpdate, Unsubscribe } from "@unicum.gg/sdk";

const REFRESH_DEBOUNCE_MS = 500;

// Noun phrases (lowercase) so they read naturally after a possessive subject,
// e.g. `Animal's stats updated`. Without a subject the first letter is
// capitalized (`Stats updated`).
const PHRASE_BY_KIND: Record<string, string> = {
  info: "info updated",
  members: "members list updated",
  events: "recent activity updated",
  snapshot: "stats updated",
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
  subject,
}: {
  subscribe: (onUpdate: (event: LiveUpdate) => void) => Unsubscribe;
  onUpdate?: () => void;
  /** Whose data updated (player nickname / clan tag). Prefixes the toast as
   * `${subject}'s stats updated`; omitted → a plain `Stats updated`. */
  subject?: string;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKindsRef = useRef<Set<string>>(new Set());
  // Kept in refs so changing identity/value doesn't tear down the SSE.
  const onUpdateRef = useRef(onUpdate);
  const subjectRef = useRef(subject);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    subjectRef.current = subject;
  }, [onUpdate, subject]);

  useEffect(() => {
    const unsubscribe = subscribe((payload) => {
      if (payload.kind) pendingKindsRef.current.add(payload.kind);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const kinds = Array.from(pendingKindsRef.current);
        pendingKindsRef.current.clear();
        const phrase =
          kinds.length === 1
            ? (PHRASE_BY_KIND[kinds[0]] ?? "data updated")
            : "data updated";
        const subject = subjectRef.current;
        const message = subject
          ? `${subject}'s ${phrase}`
          : phrase.charAt(0).toUpperCase() + phrase.slice(1);
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
