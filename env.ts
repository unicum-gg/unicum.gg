import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
  },
  client: {},
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
