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
      // Safety nets: replace a worker that leaks past the limit, and give Next's
      // own SIGTERM cleanup (it closes the HTTP server and lets in-flight
      // requests finish before exiting) time before a hard kill.
      // Sized so instances x cap stays under the container's 8g memory limit
      // (the default 5 workers x 1200M ~= 6g, headroom for the master + spikes).
      max_memory_restart: process.env.WEB_MAX_MEMORY_RESTART || "1200M",
      kill_timeout: 8000,
    },
  ],
};
