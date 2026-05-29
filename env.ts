import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
  },
  client: {},
  runtimeEnv: {
    WARGAMING_APPLICATION_ID: process.env.WARGAMING_APPLICATION_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
