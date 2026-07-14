"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Temporary navigation profiler. Off by default; enable from the browser
// console with `navdebug(true)` then reload. It logs the full client-nav
// timeline so we can see where the time actually goes:
//   ▶ click            — a link was clicked (t0)
//   · RSC ...          — the RSC fetch resource timing (server TTFB + download)
//   ✔ committed ...    — the new route rendered (click→render total)
// Server render time itself is in the server logs (PerfTrace `total=`), so the
// gap between TTFB and PerfTrace = serialization + network, and the gap between
// RSC done and commit = client render/hydration.
const KEY = "unicum.navdebug";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function NavDebug() {
  const pathname = usePathname();
  const clickRef = useRef<{ href: string; t: number } | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    // Expose the toggle even when disabled, so it can be flipped from the
    // console and picked up on the next reload.
    (window as unknown as { navdebug: (on?: boolean) => void }).navdebug = (
      on = true,
    ) => {
      try {
        localStorage.setItem(KEY, on ? "1" : "0");
      } catch {
        /* localStorage unavailable */
      }
      console.log(`[navdebug] ${on ? "ON" : "OFF"}, reload to apply`);
    };

    enabledRef.current = readEnabled();
    if (!enabledRef.current) return;
    console.log("[navdebug] active, profiling client navigations");

    function onClick(event: MouseEvent) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      const href = anchor?.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      clickRef.current = { href, t: performance.now() };
      console.log(`[navdebug] ▶ click ${href}`);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // On route commit, correlate with the RSC fetch that carried it so a single
  // line shows where the click→render time went: server (TTFB), download
  // (payload transfer), and the leftover client render/reconcile.
  useEffect(() => {
    if (!enabledRef.current) return;
    const click = clickRef.current;
    if (!click) return;
    clickRef.current = null;
    const total = Math.round(performance.now() - click.t);

    const rsc = performance
      .getEntriesByType("resource")
      .filter(
        (e): e is PerformanceResourceTiming =>
          e.name.includes("_rsc=") && e.startTime >= click.t - 50,
      )
      .at(-1);

    if (rsc) {
      const server = Math.round(rsc.responseStart - rsc.requestStart);
      const download = Math.round(rsc.responseEnd - rsc.responseStart);
      const client = Math.round(total - (rsc.responseEnd - rsc.startTime));
      const kb = Math.round((rsc.transferSize || rsc.encodedBodySize || 0) / 1024);
      console.log(
        `[navdebug] ✔ ${pathname} click→render ${total}ms  [server(TTFB)=${server}ms · download=${download}ms · client=${client}ms · size=${kb}KB]`,
      );
    } else {
      console.log(
        `[navdebug] ✔ ${pathname} click→render ${total}ms (no RSC fetch, cache hit?)`,
      );
    }
  }, [pathname]);

  return null;
}
