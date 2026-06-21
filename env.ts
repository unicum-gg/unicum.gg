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
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    // Master ad switch. Board sets it to "true" in the prod environment once real
    // data-ad-slot ids exist (UNI-43); until then AdSlot renders nothing everywhere,
    // so placements ship "dark" with zero visual impact and light up via one flip.
    // Kept OFF in dev/preview so a unit never fires there.
    NEXT_PUBLIC_ADS_ENABLED: z.enum(["true", "false"]).optional(),
  },
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ADS_ENABLED: process.env.NEXT_PUBLIC_ADS_ENABLED,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
