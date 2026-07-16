"use client";

import { useEffect, useRef, useState } from "react";
import type { Region } from "@unicum.gg/wargaming";
import { Spinner } from "@/components/ui/spinner";
import { unicum } from "@/services/sdk";

enum Phase {
  Refreshing = "refreshing",
  Done = "done",
  Idle = "idle",
}

// Skip the "Refreshing..." nag when the data was updated this recently: an
// on-demand refresh already ran on the last view, so there is nothing to wait
// for.
const FRESH_MS = 60_000;
// Give up after this long if the background refresh never reports a new
// `updatedAt` (LiveSync not connected, refresh deduped/skipped, no detectable
// change) so the indicator never sticks on "Refreshing..." forever.
const MAX_REFRESHING_MS = 25_000;

export function RefreshBeacon({
  region,
  nickname,
  updatedAt,
}: {
  region: Region;
  nickname: string;
  updatedAt: Date;
}) {
  const prevMs = useRef(updatedAt.getTime());
  // SSR-safe: render nothing until the client decides (avoids a hydration
  // mismatch on the time-dependent freshness check).
  const [phase, setPhase] = useState<Phase>(Phase.Idle);

  // On mount, only announce a refresh if the data is actually stale.
  useEffect(() => {
    if (Date.now() - prevMs.current >= FRESH_MS) setPhase(Phase.Refreshing);
  }, []);

  // Signal a live viewer so the refresh queue prioritises this player. The
  // endpoint's estimated ETA is deliberately ignored: it models the queue and
  // rate-limiter, never the real completion time (cron tick + LiveSync
  // propagation), so showing it as a countdown was permanently wrong.
  useEffect(() => {
    if (phase !== Phase.Refreshing) return;
    unicum
      .region(region)
      .players(nickname)
      .enqueue()
      .catch(() => {});
  }, [region, nickname, phase]);

  // Give up if the refresh never lands, rather than hang on "Refreshing...".
  useEffect(() => {
    if (phase !== Phase.Refreshing) return;
    const t = setTimeout(() => setPhase(Phase.Idle), MAX_REFRESHING_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // When the background refresh lands, `updatedAt` changes (LiveSync refetch):
  // flash "Updated" briefly, then hide.
  useEffect(() => {
    const ms = updatedAt.getTime();
    if (ms === prevMs.current) return;
    prevMs.current = ms;
    setPhase(Phase.Done);
    const t = setTimeout(() => setPhase(Phase.Idle), 3_000);
    return () => clearTimeout(t);
  }, [updatedAt]);

  // Rendered as direct children of the header's flex meta line, so the "·"
  // separator gets the same `gap-x-2` spacing as the other header separators
  // (Joined · Last battle · Updated).
  if (phase === Phase.Done)
    return (
      <>
        <span className="hidden sm:inline">·</span>
        <span>Updated</span>
      </>
    );
  if (phase === Phase.Refreshing)
    return (
      <>
        <span className="hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1">
          <Spinner className="size-3" aria-hidden />
          Refreshing
        </span>
      </>
    );
  return null;
}
