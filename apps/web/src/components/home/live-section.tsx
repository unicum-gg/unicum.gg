"use client";

import { useSyncExternalStore } from "react";
import type { LiveStreamer } from "@unicum.gg/shared";
import { HomeHero } from "@/components/home/home-hero";
import { LiveStreams } from "@/components/home/live-streams";
import { useLiveStreamers } from "@/hooks/use-live-streamers";
import { styles } from "@/lib/styles";
import STORAGE from "@/constants/storage";

// localStorage-backed "hide the streamers rail" preference, so a visitor who
// dismisses it stays on the plain hero across reloads. Kept in a tiny external
// store (shared across tabs via the `storage` event) and read through
// `useSyncExternalStore` so there's no hydration mismatch: the server and first
// client render both assume "not hidden", then swap to the hero if the stored
// preference says so.
//
// That swap is a render behind the first paint, so on its own it showed the
// rail for as long as hydration took to the very people who had asked not to
// see it. The document's pre-paint script reads the same key and mirrors it
// onto `html[data-hide-streams]`, which the CSS in `globals.css` acts on before
// the first frame: the markup below is unchanged for everyone else, and the
// rail is simply never painted for them. `data-streams-slot` holds the hero's
// box for the few hundred milliseconds until React catches up, so the hero
// lands in a space already the right size instead of shifting the page.
const KEY = STORAGE.LOCAL_STORAGE.HIDE_STREAMS;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  const onStorage = () => {
    syncAttribute();
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function isHidden(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
}

// The pre-paint script only runs on a document load, so every later change to
// the preference has to carry the attribute with it. Without this, a visitor
// who brought the rail back would leave `data-hide-streams` set and the CSS
// would go on hiding the rail React had just re-rendered.
function syncAttribute(): void {
  if (isHidden()) document.documentElement.dataset.hideStreams = "1";
  else delete document.documentElement.dataset.hideStreams;
}

function setHidden(hidden: boolean): void {
  localStorage.setItem(KEY, hidden ? "1" : "0");
  syncAttribute();
  listeners.forEach((notify) => notify());
}

/**
 * Chooses between the live-streamers rail and the video hero for the home page's
 * top slot: the rail when players are live and the visitor hasn't hidden it,
 * otherwise the hero (with a pill to bring the rail back when streams exist).
 */
export function LiveSection({ streamers }: { streamers: LiveStreamer[] }) {
  const hidden = useSyncExternalStore(subscribe, isHidden, () => false);
  // Read through the SSE store rather than off the server render alone. The
  // server list is a seed, not the truth: it comes from one call to Twitch at
  // render time, so a hiccup there used to decide the rail was empty, fall
  // through to the hero, and never mount the component that subscribes to the
  // push channel. The rail could then only come back on a later successful
  // revalidation, even though the worker kept publishing live streamers the
  // whole time. Subscribing here lets the push put it back within seconds.
  const live = useLiveStreamers(streamers);

  if (live.length === 0) return <HomeHero />;
  if (hidden) {
    return (
      <HomeHero
        onShowStreams={() => setHidden(false)}
        streamingCount={live.length}
      />
    );
  }
  return (
    <>
      <div data-streams-rail>
        <LiveStreams initial={live} onHide={() => setHidden(true)} />
      </div>
      {/* Same box as the hero's outer frame, so the slot it stands in for is
          already the right size. Deliberately empty: the hero's own background
          is a <video>, and rendering one here would make every visitor fetch it
          to cover a placeholder almost none of them ever see. */}
      <div
        data-streams-slot
        aria-hidden="true"
        className={`relative aspect-16/10 ${styles.borderX} w-full overflow-hidden bg-black sm:aspect-5/2 md:aspect-auto md:h-64 ${styles.screenLines}`}
      />
    </>
  );
}
