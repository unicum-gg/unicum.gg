"use client";

import { useSyncExternalStore } from "react";
import type { LiveStreamer } from "@unicum.gg/shared";
import { HomeHero } from "@/components/home/home-hero";
import { LiveStreams } from "@/components/home/live-streams";
import STORAGE from "@/constants/storage";

// localStorage-backed "hide the streamers rail" preference, so a visitor who
// dismisses it stays on the plain hero across reloads. Kept in a tiny external
// store (shared across tabs via the `storage` event) and read through
// `useSyncExternalStore` so there's no hydration mismatch: the server and first
// client render both assume "not hidden", then swap to the hero if the stored
// preference says so.
const KEY = STORAGE.LOCAL_STORAGE.HIDE_STREAMS;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isHidden(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
}

function setHidden(hidden: boolean): void {
  localStorage.setItem(KEY, hidden ? "1" : "0");
  listeners.forEach((notify) => notify());
}

/**
 * Chooses between the live-streamers rail and the video hero for the home page's
 * top slot: the rail when players are live and the visitor hasn't hidden it,
 * otherwise the hero (with a pill to bring the rail back when streams exist).
 */
export function LiveSection({ streamers }: { streamers: LiveStreamer[] }) {
  const hidden = useSyncExternalStore(subscribe, isHidden, () => false);

  if (streamers.length === 0) return <HomeHero />;
  if (hidden) {
    return (
      <HomeHero
        onShowStreams={() => setHidden(false)}
        streamingCount={streamers.length}
      />
    );
  }
  return <LiveStreams initial={streamers} onHide={() => setHidden(true)} />;
}
