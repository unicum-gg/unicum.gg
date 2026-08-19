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

function createClient(max: number): ReturnType<typeof postgres> {
  return postgres(env.DATABASE_URL, {
    max,
    prepare: false,
    // Recycle a connection after 30 min so a long-lived process never
    // accumulates stale idle backends. This is a safety net; the real zombie
    // fix is the graceful drain in `cron/shutdown.ts`, which closes both
    // pools on SIGTERM so a redeploy leaves no leaked connections behind
    // (Postgres would otherwise hold a dead container's idle backends for
    // tens of minutes before reaping them).
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

function resolveClient(): ReturnType<typeof postgres> {
  // Build phase: Next.js spawns one SSG worker per CPU core (`experimental.cpus`,
  // default `os.cpus().length - 1`), each its own process (separate globalThis)
  // with its own pool. Cap at 3 so 11 workers × 3 = 33 stays well under postgres
  // `max_connections=100` → no "sorry, too many clients already" mid-SSG. The
  // cron-concurrency concern doesn't apply here: `instrumentation.ts` only boots
  // on the server runtime, never at build time.
  if (isBuild) return createClient(3);

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
    // crons. 30 + the request pool (14) stays well under postgres
    // `max_connections=100`, with room for a second replica.
    return (globalForDb.__pgBackground ??= createClient(30));
  }
  // Request pool, per process. Under PM2 cluster the web runs N worker processes,
  // each with its own pool, so this must be sized as `~max_connections / N` (minus
  // the worker service's background pool + headroom) to stay under postgres's
  // `max_connections`. `DB_POOL_MAX` lets the PM2 ecosystem set it per instance;
  // 14 is the single-process default (unchanged when not clustered).
  const requestMax = Number(process.env.DB_POOL_MAX) || 14;
  return (globalForDb.__pgRequest ??= createClient(requestMax));
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
