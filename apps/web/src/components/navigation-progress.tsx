"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// A thin global progress bar pinned to the top of the viewport, animating while
// a route transition is in flight. Most per-entity pages are `force-dynamic`, so
// a click incurs a server round-trip with no built-in feedback; this fills that
// gap the way YouTube/GitHub top loaders do.
//
// `useLinkStatus` (next/link) only reports one Link's pending state, so a global
// bar can't use it. Instead we start on the three navigation entry points a
// `<Link>`-only hook misses (anchor clicks, programmatic `router.push`/`replace`
// via a `history` patch, and back/forward via `popstate`) and finish when the
// committed route (`pathname` + `searchParams`) changes.

const TRICKLE_CEILING = 90;
const FAILSAFE_MS = 12_000;

// Programmatic navigations (`router.push` from the search dialog, for instance)
// are not anchor clicks, and Next only calls `pushState` once the RSC payload
// has landed, so the history patch below fires at the *end* of the transition.
// Callers announce those navigations up front with this event instead.
const START_EVENT = "unicum:navigation-start";

/** Light the global progress bar for a navigation that isn't an anchor click. */
export function startNavigationProgress() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(START_EVENT));
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams}`;

  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);

  // Latest state exposed to the imperative listeners without re-subscribing.
  const visibleRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedKey = useRef<string | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const clearTimers = () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      if (settleRef.current) clearTimeout(settleRef.current);
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
      trickleRef.current = null;
      settleRef.current = null;
      failsafeRef.current = null;
    };

    const start = () => {
      if (visibleRef.current) return;
      clearTimers();
      visibleRef.current = true;
      setVisible(true);
      setValue(8);
      // Trickle toward the ceiling with diminishing steps, so the bar keeps
      // moving during the wait but never reaches the end before the route lands.
      trickleRef.current = setInterval(() => {
        setValue((current) => {
          if (current >= TRICKLE_CEILING) return current;
          const remaining = TRICKLE_CEILING - current;
          return current + Math.max(0.4, remaining * 0.08);
        });
      }, 220);
      // Never leave the bar stuck if a navigation resolves without a route-key
      // change (e.g. a replace to the same URL, or an aborted transition).
      failsafeRef.current = setTimeout(() => finish(), FAILSAFE_MS);
    };

    const finish = () => {
      if (!visibleRef.current) return;
      clearTimers();
      setValue(100);
      settleRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setValue(0);
      }, 260);
    };

    const shouldIntercept = (event: MouseEvent, anchor: HTMLAnchorElement) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return false;
      if (anchor.target && anchor.target !== "_self") return false;
      if (anchor.hasAttribute("download")) return false;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return false;

      let dest: URL;
      try {
        dest = new URL(anchor.href, window.location.href);
      } catch {
        return false;
      }
      if (dest.origin !== window.location.origin) return false;
      // Same page (only a hash jump, or an exact match) is not a navigation.
      const here = window.location;
      if (dest.pathname === here.pathname && dest.search === here.search)
        return false;
      return true;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      if (shouldIntercept(event, anchor as HTMLAnchorElement)) start();
    };

    // `router.push`/`replace` commit through the History API; patch it so
    // programmatic navigations light the bar too.
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args) {
      start();
      return origPush.apply(this, args);
    };
    history.replaceState = function (...args) {
      return origReplace.apply(this, args);
    };

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", start);
    window.addEventListener(START_EVENT, start);

    return () => {
      clearTimers();
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", start);
      window.removeEventListener(START_EVENT, start);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
    // Listeners are installed once; `start`/`finish` close over refs, not state.
  }, []);

  // The committed route changed → the transition landed. Skip the initial mount.
  useEffect(() => {
    if (mountedKey.current === null) {
      mountedKey.current = routeKey;
      return;
    }
    if (mountedKey.current === routeKey) return;
    mountedKey.current = routeKey;
    if (!visibleRef.current) return;
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);
    trickleRef.current = null;
    failsafeRef.current = null;
    setValue(100);
    settleRef.current = setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      setValue(0);
    }, 260);
  }, [routeKey]);

  return (
    <div
      aria-hidden
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="nav-progress-bar h-full"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function NavigationProgress() {
  // `useSearchParams` opts its subtree into client rendering, so the boundary
  // keeps that bailout local and leaves the ISR pages statically generated.
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
