import { env } from "@unicum.gg/shared";
import v8 from "node:v8";

export const dynamic = "force-dynamic";

/**
 * What one cluster worker is actually holding, split into the two halves that
 * need different fixes.
 *
 * The cluster is sized by memory rather than by cores: `ecosystem.config.cjs`
 * divides a budget across the workers, so the per-worker working set is what
 * decides how many may run, and the worker count is what decides how many
 * cores render pages. Measured 2026-10-20: four workers on a twelve-core host,
 * each holding 2236 to 2481 MB against a 2550 MB kill threshold, with
 * `/api/health` (a hardcoded `{status:"ok"}`, no database and no await)
 * answering in 200ms because every request queues behind a saturated event
 * loop. Raising the worker count is arithmetically impossible at that size: the
 * config derives the heap ceiling from the same budget, so six workers put it
 * at 550 MB, which is the number the 2026-09-15 outage is written up under.
 *
 * So the question is which half the 2.4 GB is in, and nothing deployed could
 * answer it. If it is V8's old space near the 1400 MB ceiling, the per-worker
 * in-process caches are the cause and moving them into the shared Redis shrinks
 * every worker at once. If the heap is modest and the rest is outside it, the
 * cause is native (sockets, buffers, compiled code) and sharing a cache buys
 * nothing. `NON_HEAP_MB` in the config is calibrated at 1150 MB, so both
 * readings are plausible from the outside and neither is worth acting on
 * unmeasured.
 *
 * A heap snapshot would say the same thing in far more detail and cannot be
 * taken here: it walks the whole heap and holds a second copy while it writes,
 * on a process already within 69 MB of the threshold that kills it.
 *
 * One call reaches ONE worker, whichever the cluster hands it to, so `pmId`
 * is reported and the caller polls until it has seen them all.
 *
 * Not `@openapi`-tagged, so it stays out of the public document and the SDK.
 * Authorised by `CRON_SECRET`, like the review routes beside it.
 */
export function GET(request: Request): Response {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  const usage = process.memoryUsage();
  const heap = v8.getHeapStatistics();

  return Response.json({
    // PM2 sets both in cluster mode. Reported raw so a missing value reads as
    // "not under PM2" rather than as worker 0.
    pmId: process.env.pm_id ?? process.env.NODE_APP_INSTANCE ?? null,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    processMb: {
      // What PM2 compares against `max_memory_restart`.
      rss: mb(usage.rss),
      heapTotal: mb(usage.heapTotal),
      heapUsed: mb(usage.heapUsed),
      // Outside the heap: native allocations V8 knows about.
      external: mb(usage.external),
      arrayBuffers: mb(usage.arrayBuffers),
    },
    heapMb: {
      // `--max-old-space-size` plus V8's constant 192 MiB of other spaces.
      limit: mb(heap.heap_size_limit),
      total: mb(heap.total_heap_size),
      used: mb(heap.used_heap_size),
      mallocedPeak: mb(heap.peak_malloced_memory),
    },
    // Per-space, which is what separates a cache (old space) from compiled code
    // and from the single large objects a payload cache holds.
    spacesMb: v8.getHeapSpaceStatistics().map((space) => ({
      name: space.space_name,
      size: mb(space.space_size),
      used: mb(space.space_used_size),
      available: mb(space.space_available_size),
    })),
  });
}
