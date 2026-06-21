import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID_EU: z.string(),
    WARGAMING_APPLICATION_ID_NA: z.string(),
    WARGAMING_APPLICATION_ID_ASIA: z.string(),
    DATABASE_URL: z.url(),
    CRON_SECRET: z.string(),
    // Discord stat-card bot (UNI-9). Optional so the app still boots before
    // the CEO provisions the Discord application secrets in Coolify. The
    // interactions route runtime-guards on these and returns 503 when unset.
    DISCORD_APP_ID: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
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
    DISCORD_APP_ID: process.env.DISCORD_APP_ID,
    DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
