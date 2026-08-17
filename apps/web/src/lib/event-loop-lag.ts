import { monitorEventLoopDelay } from "node:perf_hooks";

// Event-loop lag monitor. The site's outages present as `/api/health` (a trivial
// synchronous handler) timing out for many seconds, which can only mean the
// event loop was blocked long enough that the server could not even `accept()`
// the health probe's connection. That blocking has never reproduced locally
// (load tests keep the loop responsive under a 300-concurrent cold-render flood
// with Redis at its ceiling and every core pinned), so it is environmental and
// needs to be caught in prod to be diagnosed. This logs, once per window, the
// worst loop stall seen — with RSS, so a GC-pause stall (high RSS) is
// distinguishable from a pure CPU/accept stall — giving the next incident a real
// cause instead of a guess. It only observes: no behaviour change, negligible cost.
let started = false;

export function startEventLoopLagMonitor({
  thresholdMs = 1000,
  windowMs = 5000,
}: { thresholdMs?: number; windowMs?: number } = {}): void {
  if (started) return;
  started = true;

  const h = monitorEventLoopDelay({ resolution: 20 });
  h.enable();

  const timer = setInterval(() => {
    const maxMs = h.max / 1e6; // histogram is in nanoseconds
    if (maxMs >= thresholdMs) {
      const p99Ms = h.percentile(99) / 1e6;
      const meanMs = h.mean / 1e6;
      const rssMiB = process.memoryUsage().rss / 1048576;
      console.warn(
        `[event-loop-lag] stall: max=${maxMs.toFixed(0)}ms p99=${p99Ms.toFixed(0)}ms mean=${meanMs.toFixed(0)}ms window=${windowMs / 1000}s rss=${rssMiB.toFixed(0)}MiB`,
      );
    }
    h.reset();
  }, windowMs);

  // Never keep the process alive for the monitor alone.
  timer.unref();
}
