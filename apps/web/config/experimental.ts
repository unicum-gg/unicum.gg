import type { NextConfig } from "next";

export const experimental: NextConfig["experimental"] = {
  // Cap the build's worker pool.
  //
  // This defaults to `os.cpus().length - 1`, which on the 8-vCPU deploy host
  // opens 7 workers. Each is a full Node process that inherits the runtime's
  // 4 GiB V8 heap ceiling, and V8 paces its GC against that ceiling rather
  // than against what the machine has left, so the pool held 12 GiB of
  // private memory on a 22 GiB box that also runs the app, Postgres and
  // Redis. The kernel OOM-killed Postgres three times on 2026-08-06, twice
  // taking the build down with it (builds 11:43 and 12:20 both died within
  // 70s of a kill). Postgres was an innocent victim: it held 335 MiB of
  // private memory, but every backend maps the 2816 MB shared_buffers
  // segment, so the kernel scored each of them at ~2.8 GB.
  //
  // 4 keeps the box responsive while it builds, at the cost of a longer
  // static-generation phase. Note this is the only knob that works:
  // `staticGenerationMinPagesPerWorker` exists in the config schema but is
  // never read in 16.2.6 (verified: setting it left the pool untouched).
  cpus: 4,
  // Collapse the router's per-segment prefetch into one request per link.
  //
  // Next 16 splits every prefetch into a request per route segment (the tree,
  // the head, each layout, the page). Measured on /tanks, whose grid puts
  // dozens of links in the viewport, that is 97 requests and 6.8 MB of flight
  // payload on a single page view. Inlining bundles the small segments into
  // one response, so a link costs one round trip instead of three or four.
  // Ships default-off in 16.2 and default-on in 16.3.
  prefetchInlining: true,
};
