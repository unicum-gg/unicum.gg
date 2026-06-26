import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, {
    // The 9 cron jobs + concurrent page requests easily saturate a pool
    // of 5; once exhausted, the 6th+ waits and page renders stretch from
    // ~50ms to multiple seconds. Runtime pool = 12.
    //
    // Build phase is shrunk to 3: Next.js spawns one worker per CPU core
    // (`experimental.cpus`, default `os.cpus().length - 1`), each with its
    // own pool, so the count multiplies fast. On a 12-core dev box that's
    // 11 workers × 12 = 132 > postgres `max_connections=100` → "sorry,
    // too many clients already" mid-SSG. 11 × 3 = 33 leaves comfortable
    // headroom for the running runtime container, coolify-db sessions,
    // and admin. The 9-cron concurrency concern doesn't apply at build
    // time — `instrumentation.ts` only boots on the server runtime.
    max:
      process.env.NEXT_PHASE === "phase-production-build" ? 3 : 12,
    prepare: false,
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
    connection:
      process.env.NEXT_PHASE === "phase-production-build"
        ? { options: "-c max_parallel_workers_per_gather=0" }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
