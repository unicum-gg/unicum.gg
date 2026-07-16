"use client";

import { useEffect, useRef, useState } from "react";
import type { Region } from "@unicum.gg/wargaming";
import { Spinner } from "@/components/ui/spinner";
import { unicum } from "@/services/sdk";

// Whether the beacon drives a player or a clan refresh. Both go through their
// own SDK enqueue endpoint (which returns an ETA) and their own live channel.
// (Client-side twin of core's `RefreshSubject`, which can't be imported here
// without pulling the server stack into the browser bundle.)
export enum RefreshKind {
  Player = "player",
  Clan = "clan",
}

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

export type BeaconState = { phase: Phase; remaining: number | null };

function enqueueFor(kind: RefreshKind, region: Region, id: string) {
  const r = unicum.region(region);
  return kind === RefreshKind.Player
    ? r.players(id).enqueue()
    : r.clans(id).enqueue();
}

/**
 * The refresh-beacon logic, extracted as a hook so a header that renders its
 * meta line more than once (e.g. the clan header's responsive desktop/mobile
 * variants) can run the enqueue + countdown ONCE and render the indicator in
 * each variant from the same state, instead of firing duplicate enqueues.
 */
export function useRefreshBeacon(
  kind: RefreshKind,
  region: Region,
  id: string,
  updatedAt: Date | null,
): BeaconState {
  const prevMs = useRef(updatedAt ? updatedAt.getTime() : 0);
  // SSR-safe: render nothing until the client decides (avoids a hydration
  // mismatch on the time-dependent freshness check).
  const [phase, setPhase] = useState<Phase>(Phase.Idle);
  // Seconds left on the estimated wait. Null means "unknown yet" or "estimate
  // overran": we then show the spinner without a number rather than a fake 0.
  const [remaining, setRemaining] = useState<number | null>(null);

  // On mount, only announce a refresh if the data is actually stale (or we have
  // no timestamp at all — `prevMs` is 0 then, so we can't tell and assume
  // stale). Reads only the ref so it stays a mount-only effect.
  useEffect(() => {
    if (prevMs.current === 0 || Date.now() - prevMs.current >= FRESH_MS) {
      setPhase(Phase.Refreshing);
    }
  }, []);

  // Signal a live viewer so the queue prioritises this entity, and seed the
  // countdown from the endpoint's measured-latency estimate. The give-up
  // timeout scales with the estimate (2x, clamped) so a legitimately long
  // refresh isn't hidden before it lands.
  useEffect(() => {
    if (phase !== Phase.Refreshing) return;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    enqueueFor(kind, region, id)
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
  }, [kind, region, id, phase]);

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
    const ms = updatedAt ? updatedAt.getTime() : null;
    if (ms === null || ms === prevMs.current) return;
    prevMs.current = ms;
    setPhase(Phase.Done);
    setRemaining(null);
    const t = setTimeout(() => setPhase(Phase.Idle), 3_000);
    return () => clearTimeout(t);
  }, [updatedAt]);

  return { phase, remaining };
}

/**
 * Presentational half of the beacon: renders the "· Refreshing ~Ns" / "·
 * Updated" text from a {@link BeaconState}. Pure, so it can be rendered in
 * multiple responsive copies of a meta line without side effects. Meant to sit
 * as direct children of a flex meta row so the "·" separator gets the same
 * gap spacing as the row's other separators.
 */
export function RefreshIndicator({ phase, remaining }: BeaconState) {
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

/**
 * Single-instance convenience: runs the beacon hook and renders its indicator.
 * Use where the meta line renders once (e.g. the player header). For a header
 * that duplicates its meta line, call {@link useRefreshBeacon} once and render
 * {@link RefreshIndicator} in each copy instead.
 */
export function RefreshBeacon({
  kind,
  region,
  id,
  updatedAt,
}: {
  kind: RefreshKind;
  region: Region;
  id: string;
  updatedAt: Date | null;
}) {
  const state = useRefreshBeacon(kind, region, id, updatedAt);
  return <RefreshIndicator {...state} />;
}
