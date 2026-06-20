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
    // ~50ms to multiple seconds. Bumped to 12.
    //
    // Ceiling is the build, NOT runtime: Next.js spawns 5 SSG workers and
    // each opens its own pool. 5 × 12 = 60 connections during prerender,
    // leaving headroom under postgres `max_connections=100` for the
    // running runtime container (12) + coolify-db sessions (~5) + admin.
    // A pool of 20 here pushed us to 5×20=100 exactly, blowing the build
    // with "sorry, too many clients already".
    max: 12,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
