import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
    // Optional: when set, live pub/sub (LiveSync SSE) fans out through Redis so
    // updates cross processes/instances. Unset = in-process only (local dev).
    REDIS_URL: z.string().optional(),
    // Base URL the SDK uses for **server-side** (SSR/ISR) calls to our own API.
    // Set to the loopback (`http://127.0.0.1:${PORT}/api`) in prod so renders
    // hit the same container in-process instead of hairpinning out through the
    // public domain/CDN. Unset = the SDK default (`${NEXT_PUBLIC_APP_URL}/api`).
    UNICUM_API_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    // Base URL the SDK uses for **browser** calls to our own API. Unset = the
    // SDK default (relative `/api`, same-origin, no CORS). Set to an absolute
    // URL only if the browser must reach a different origin.
    NEXT_PUBLIC_UNICUM_API_URL: z.string().optional(),
  },
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    UNICUM_API_URL: process.env.UNICUM_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_UNICUM_API_URL: process.env.NEXT_PUBLIC_UNICUM_API_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
