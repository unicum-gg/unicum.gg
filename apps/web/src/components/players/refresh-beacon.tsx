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
// Hard floor for the give-up timeout: even if the endpoint estimates a shorter
// wait, keep the indicator up at least this long before hiding it.
const MIN_GIVE_UP_MS = 25_000;
// Absolute ceiling so a wildly optimistic (or pessimistic) estimate can't leave
// the indicator stuck forever.
const MAX_GIVE_UP_MS = 90_000;

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
  // Seconds left on the estimated wait. Null means "unknown yet" or "estimate
  // overran": we then show the spinner without a number rather than a fake 0.
  const [remaining, setRemaining] = useState<number | null>(null);

  // On mount, only announce a refresh if the data is actually stale.
  useEffect(() => {
    if (Date.now() - prevMs.current >= FRESH_MS) setPhase(Phase.Refreshing);
  }, []);

  // Signal a live viewer so the queue prioritises this player, and seed the
  // countdown from the endpoint's measured-throughput estimate. The give-up
  // timeout scales with the estimate (2x, clamped) so a legitimately long
  // refresh isn't hidden before it lands.
  useEffect(() => {
    if (phase !== Phase.Refreshing) return;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    unicum
      .region(region)
      .players(nickname)
      .enqueue()
      .then((res) => {
        if (!active) return;
        const eta = (res as { estimatedSeconds?: number })?.estimatedSeconds;
        if (typeof eta === "number" && eta > 0) setRemaining(eta);
        const giveUpMs = Math.min(
          MAX_GIVE_UP_MS,
          Math.max(MIN_GIVE_UP_MS, (eta ?? 0) * 2 * 1000),
        );
        giveUp = setTimeout(() => setPhase(Phase.Idle), giveUpMs);
      })
      .catch(() => {
        if (!active) return;
        giveUp = setTimeout(() => setPhase(Phase.Idle), MIN_GIVE_UP_MS);
      });
    return () => {
      active = false;
      if (giveUp) clearTimeout(giveUp);
    };
  }, [region, nickname, phase]);

  // Tick the countdown down once a second; the last tick drops to null (spinner
  // only) rather than showing "0s", since the refresh is simply running long.
  useEffect(() => {
    if (phase !== Phase.Refreshing || remaining === null || remaining <= 0)
      return;
    const t = setTimeout(
      () => setRemaining((r) => (r === null || r <= 1 ? null : r - 1)),
      1_000,
    );
    return () => clearTimeout(t);
  }, [phase, remaining]);

  // When the background refresh lands, `updatedAt` changes (LiveSync refetch):
  // flash "Updated" briefly, then hide.
  useEffect(() => {
    const ms = updatedAt.getTime();
    if (ms === prevMs.current) return;
    prevMs.current = ms;
    setPhase(Phase.Done);
    setRemaining(null);
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
          {remaining !== null && (
            <span className="opacity-70">~{remaining}s</span>
          )}
        </span>
      </>
    );
  return null;
}
