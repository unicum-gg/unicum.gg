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
    // ~50ms to multiple seconds. Bumped to 20; postgres `max_connections`
    // is 100, so 4 app instances + admin sessions still fit.
    max: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
