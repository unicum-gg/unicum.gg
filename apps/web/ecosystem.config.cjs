const os = require("node:os");
const path = require("node:path");

// One `next start` uses a single core for JS; a full player render is ~85ms of
// main-thread CPU, so one process tops out near ~12 renders/s and collapses under
// concurrency. PM2 cluster forks the standalone server across cores (Node's
// cluster shares the port), multiplying that ceiling ~Nx. Leave a few cores for
// postgres + the worker service; override with WEB_CLUSTER_INSTANCES.
const instances = process.env.WEB_CLUSTER_INSTANCES
  ? Number(process.env.WEB_CLUSTER_INSTANCES)
  : Math.max(2, os.cpus().length - 3);

// Each worker is its own process with its own postgres pool, so the per-worker
// pool must be sized as ~(web budget / instances). The server runs
// max_connections=200 (set in the Coolify custom postgres config, see AGENTS.md):
// 60 here, 40 for the worker service's background pool, and the ~100 left over
// absorb everything else that reaches this same server, because there is no dev
// database: the on-host `next build` (4 SSG workers x 3), an open PR's preview
// deployment, every `pnpm dev` worktree (16 each), psql, drizzle-studio and the
// backups. A pool holds its historical peak concurrency rather than shrinking on
// idle under steady traffic, so treat these as standing costs, not as burst
// headroom. See DB_POOL_MAX / DB_BACKGROUND_POOL_MAX in packages/core/src/db.
//
// The 4 floor wins over the division past 15 instances; a host that big needs
// the budget revisited rather than this arithmetic trusted.
const dbPoolMax = process.env.DB_POOL_MAX
  ? Number(process.env.DB_POOL_MAX)
  : Math.max(4, Math.floor(60 / instances));

// The heap ceiling and the kill threshold are one decision, not two, so they are
// derived from the same budget here.
//
// V8 paces its GC against its own ceiling rather than against what the process
// is allowed to hold. Left alone a worker inherits a ~4 GiB default (Node sizes
// it from host RAM and does not read the container's cgroup limit), so it grows
// steadily while V8 sees no reason to collect, and PM2 kills it at
// `max_memory_restart` long before that reason arrives. Every worker is then
// guaranteed to be killed, in a loop. Because the cluster starts together it
// also grows together and hits the threshold together: on 2026-08-21 that left
// no live backend at all and the proxy served 503 for 53 minutes, with the
// requests already in flight timing out at 30s.
//
// So: take the container's memory limit, keep a slice back for the PM2 master
// and for spikes, and divide the rest across the workers. That share is the
// kill threshold, and the heap ceiling sits one NON_HEAP_MB below it, so V8
// collects on its own before PM2 has to intervene and `max_memory_restart` goes
// back to being a leak net instead of the thing pacing the cluster.
//
// NON_HEAP_MB covers the two things a worker holds beyond its old space.
// First, V8's other spaces: `--max-old-space-size=N` is not the heap limit,
// `v8.getHeapStatistics().heap_size_limit` comes back at N + 192 MiB, and that
// 192 is a constant, not a ratio (measured on node 22 at N = 512, 777, 900,
// 1042 and 1500: +192 every time). Second, what lives outside the V8 heap
// entirely: native buffers, sockets, stacks, compiled code. The rest of the
// slice is the allowance for that.
//
// Keep any Coolify `NODE_OPTIONS` off the runtime (buildtime only, or unset).
// It reaches `start` too, and a heap ceiling set there is invisible from this
// arithmetic, which is exactly how the two drifted apart.
//
// The kill threshold is derived from the heap ceiling and not the reverse, so
// that `heapCapMb + NON_HEAP_MB === killAtMb` holds even when the 512 floor
// kicks in. Past ~13 instances the floor wins over the division and
// instances x killAtMb climbs back over the budget: like the pool arithmetic
// above, that is the signal to revisit the budget for a host that size rather
// than to trust these numbers.
const memoryBudgetMb = Number(process.env.WEB_MEMORY_BUDGET_MB || 8192);
const NON_HEAP_MB = 450;
const heapCapMb = Math.max(
  512,
  Math.floor((memoryBudgetMb * 0.85) / instances) - NON_HEAP_MB,
);
const killAtMb = heapCapMb + NON_HEAP_MB;

// PM2 loads this at runtime and reads plain CJS (not TS/tsx), so it stays .cjs;
// the JSDoc gives editor type-checking of the config shape without a runtime dep.
/** @type {{ apps: import("pm2").StartOptions[] }} */
module.exports = {
  apps: [
    {
      name: "unicum-web",
      // Run the Next standalone server from its own dir so its __dirname-relative
      // asset lookups (.next/static, public — copied in by copy-standalone-assets)
      // resolve.
      cwd: path.join(__dirname, ".next/standalone/apps/web"),
      script: "server.js",
      exec_mode: "cluster",
      instances,
      // Passed as a real argv flag rather than through `env.NODE_OPTIONS`: V8
      // reads NODE_OPTIONS first and the command line second, so this wins even
      // if a stray NODE_OPTIONS is still set on the container.
      node_args: `--max-old-space-size=${heapCapMb}`,
      env: {
        PORT: process.env.PORT || "3000",
        // Force 0.0.0.0: the Next standalone server binds to `process.env.HOSTNAME`,
        // and Docker sets HOSTNAME to the container id — so inheriting it would bind
        // the server to that one interface and Coolify's localhost healthcheck could
        // never reach it (the container is marked unhealthy and rolled back). `next
        // start` avoided this by binding via HOST instead.
        HOSTNAME: "0.0.0.0",
        DB_POOL_MAX: String(dbPoolMax),
        // Pin the cron gate here rather than trusting the Coolify UI value.
        // `instrumentation.ts` boots the crons unless this is exactly "0" or
        // "false", and each of the N cluster workers that did would open its own
        // 40-connection background pool: 5 x (40 + 12) = 260 against a 200
        // connection server. The dedicated worker service owns the crons.
        RUN_CRONS: process.env.RUN_CRONS || "0",
      },
      // Safety nets: replace a worker that leaks past its share (see the budget
      // arithmetic above), and give Next's own SIGTERM cleanup (it closes the
      // HTTP server and lets in-flight requests finish before exiting) time
      // before a hard kill.
      max_memory_restart: process.env.WEB_MAX_MEMORY_RESTART || `${killAtMb}M`,
      kill_timeout: 8000,
    },
  ],
};
