import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * Framework-agnostic env, shared by the Next app and the standalone worker.
 *
 * `NEXT_PUBLIC_APP_URL` is modelled as a real client var (via `clientPrefix`)
 * so `app-identity` can read it through `env` and it stays valid even when the
 * module is pulled into a browser bundle. That forces the explicit `runtimeEnv`
 * map below: env-core reads each key by computed access, and Turbopack only
 * inlines `process.env.NEXT_PUBLIC_*` on a STATIC member access, so a bare
 * `runtimeEnv: process.env` would hand env-core `undefined` on the client and
 * throw at init. Listing each var statically is exactly what `env-nextjs` does.
 */
export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
    // Better Auth session/cookie signing + encryption key. Optional at the env
    // layer so the worker (which never loads the auth instance) boots without
    // it; the web asserts its presence where the auth instance is created.
    BETTER_AUTH_SECRET: z.string().optional(),
    // When set, live pub/sub + the WG cache/rate-limit fan out through Redis so
    // they are shared across processes/instances. Unset = in-process (dev).
    REDIS_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
