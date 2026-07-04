import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * Framework-agnostic server env, shared by the Next app and the standalone
 * worker. The web app keeps its own `env.ts` (via `@t3-oss/env-nextjs`) for
 * the client `NEXT_PUBLIC_*` vars; that URL is also read here server-side for
 * the outbound bot identity.
 */
export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
    // When set, live pub/sub + the WG cache/rate-limit fan out through Redis so
    // they are shared across processes/instances. Unset = in-process (dev).
    REDIS_URL: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
