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
    max: 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
