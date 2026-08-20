import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@unicum.gg/shared";
import { schema } from "@unicum.gg/shared";

type DbContext = "request" | "background";

const globalForDb = globalThis as unknown as {
  __pgRequest: ReturnType<typeof postgres> | undefined;
  __pgBackground: ReturnType<typeof postgres> | undefined;
  __dbContext: DbContext | undefined;
};

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const isProduction = process.env.NODE_ENV === "production";

// Seconds a pooled connection may sit unused before postgres.js closes it. The
// default is `null` (never), which is how a 100-connection server ended up with
// 88 idle backends on 2026-08-20: every pool had climbed to its `max` on some
// past burst and held those backends until `max_lifetime` recycled them.
//
// Read what this does and does not buy, because the pool is FIFO, not LIFO:
// `handler()` dispatches to `open.shift()` (the least recently released
// connection) and `move(c, open)` restarts that connection's idle timer on
// every release, so the whole pool is round-robined and a connection only
// expires if the pool is larger than `requests/s x timeout`. Under steady
// traffic nothing is released and the pool stays at its historical peak
// concurrency. The win is on intermittent workloads: a dev instance nobody is
// browsing, an off-peak night, a worker between two heavy ticks. It is a floor
// on waste, not a substitute for a correctly sized `max`.
const REQUEST_IDLE_TIMEOUT = 20;
// Longer than the request pool on purpose: cron ticks are periodic, so a 20s
// window would just churn the whole pool between ticks.
const BACKGROUND_IDLE_TIMEOUT = 60;

function createClient(
  max: number,
  idleTimeout: number | undefined,
): ReturnType<typeof postgres> {
  return postgres(env.DATABASE_URL, {
    max,
    prepare: false,
    idle_timeout: idleTimeout,
    // Recycle a connection after 30 min so a long-lived process never
    // accumulates stale idle backends. This is a safety net; the graceful drain
    // in `cron/shutdown.ts` closes both pools on SIGTERM so a redeploy leaves no
    // leaked connections behind. That drain only runs to completion in
    // `apps/worker`, which owns its process: on the web, Next exits on SIGTERM
    // before an async drain can finish (see the note in `instrumentation.ts`),
    // and the socket close on exit is what frees those backends instead.
    max_lifetime: 60 * 30,
    // Build-phase only: disable Postgres parallel query workers for this
    // connection. The clan-leaderboard aggregations (`clan_members` JOIN
    // `players` GROUP BY clan_id) pick a Parallel Hash plan that allocates
    // ~96MB of shared memory per query (DSM, served from /dev/shm). The
    // Coolify-managed Postgres container ships with Docker's default
    // /dev/shm = 64MB and can't even fit ONE such allocation, let alone
    // the ~24 prerenders Next.js fans out during SSG export. Forcing the
    // planner to use sequential plans removes the shared-memory pressure
    // entirely (work_mem is local to each backend, not in /dev/shm).
    // Cost: per-query ~2x wall time, but full SSG parallelism preserved
    // so net build time is better than capping `experimental.cpus`.
    // Runtime keeps its parallel workers untouched.
    connection: isBuild
      ? { options: "-c max_parallel_workers_per_gather=0" }
      : undefined,
  });
}

// Dev instances reach the same server as production (there is no dev database),
// and several worktrees running at once used to hold ~20 backends hostage on a
// 100-connection server. A dev process serves one browser, so a handful is
// plenty, and it keeps one `pnpm dev` per branch out of the production budget.
const DEV_POOL_MAX = 8;

/**
 * Ceiling for one pool: an explicit env override wins (a non-numeric or zero
 * value falls through to the default rather than producing a broken pool),
 * otherwise production gets its budgeted share and development the small fixed
 * one above. The production values are also set explicitly in the deployment
 * (PM2 env for the web, Coolify env for the worker), so a missing NODE_ENV
 * cannot quietly downgrade a live service to the dev size.
 */
function poolSize(envKey: string, prodMax: number): number {
  return Number(process.env[envKey]) || (isProduction ? prodMax : DEV_POOL_MAX);
}

function resolveClient(): ReturnType<typeof postgres> {
  // Build phase: Next.js spawns one SSG worker per `experimental.cpus` (pinned to
  // 4 in `config/experimental.ts`, see the OOM story there), each its own process
  // (separate globalThis) with its own pool. Cap at 3 so 4 workers × 3 = 12 stays
  // a rounding error against `max_connections` → no "sorry, too many clients
  // already" mid-SSG, even though the build runs on the deploy host while the
  // previous release still holds its own pools. No idle timeout here: a build is
  // a bounded burst that ends with the process, and a reconnect mid-SSG that lost
  // the race for a connection would be swallowed by `buildSafe` and prerender an
  // empty shell. The cron-concurrency concern doesn't apply: `instrumentation.ts`
  // only boots on the server runtime, never at build time.
  if (isBuild) return createClient(3, undefined);

  // Runtime: two deliberately-sized pools, one per execution context, both
  // memoized on `globalThis` so they are shared across every Turbopack bundle
  // in the process (SSR pages, route handlers, instrumentation) instead of each
  // bundle spinning up its own copy. Without this memo the module is duplicated
  // per bundle and the pool count silently multiplies.
  //
  // `instrumentation.ts` marks the cron-boot window as "background"; everything
  // else is "request". This keeps a heavy or hung cron tick from starving the
  // connections that serve page reads: the two workloads never share a pool.
  const context = globalForDb.__dbContext ?? "request";
  if (context === "background") {
    // Sized for the snapshot pipeline: several regions x workers x per-chunk
    // writers all draw from here, plus the refill claims and the other background
    // crons. Only the worker service ever opens this pool: the web sets
    // `RUN_CRONS=0` in `ecosystem.config.cjs`, without which each of its N PM2
    // workers would open one of these too and blow the budget N-fold.
    const backgroundMax = poolSize("DB_BACKGROUND_POOL_MAX", 40);
    return (globalForDb.__pgBackground ??= createClient(
      backgroundMax,
      BACKGROUND_IDLE_TIMEOUT,
    ));
  }
  // Request pool, per process. Under PM2 cluster the web runs N worker processes,
  // each with its own pool, so this is sized as `web budget / N` by the ecosystem
  // config, which sets `DB_POOL_MAX` per instance; 14 is the single-process
  // default (unchanged when not clustered).
  const requestMax = poolSize("DB_POOL_MAX", 14);
  return (globalForDb.__pgRequest ??= createClient(
    requestMax,
    REQUEST_IDLE_TIMEOUT,
  ));
}

const client = resolveClient();

/**
 * Close both runtime pools, waiting up to 5s for in-flight queries to finish.
 * Called from the SIGTERM/SIGINT handler so a redeploy drains cleanly instead
 * of leaving idle backends that Postgres only reaps minutes later.
 */
export async function closeDbPools(): Promise<void> {
  const pools = [globalForDb.__pgRequest, globalForDb.__pgBackground].filter(
    (p): p is ReturnType<typeof postgres> => Boolean(p),
  );
  await Promise.allSettled(pools.map((p) => p.end({ timeout: 5 })));
  globalForDb.__pgRequest = undefined;
  globalForDb.__pgBackground = undefined;
}

export const db = drizzle(client, { schema });
export { schema };

/**
 * The raw postgres.js client behind `db`. Exposed for the rare case that needs
 * a server-side cursor to stream a very large result set without buffering it
 * all in memory (e.g. the per-tank leaderboard scan over tank_snapshots). Use
 * `db` for everything else.
 */
export { client as pgClient };
