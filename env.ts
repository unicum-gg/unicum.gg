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
    // AdSense data-ad-slot ids, one per AdSlot format. Optional so the app boots
    // and slots ship "dark" (reserved space, no push) until real ids are created
    // in the AdSense dashboard (UNI-43) and dropped in without a code change.
    NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD: z.string().optional(),
    NEXT_PUBLIC_ADSENSE_SLOT_IN_FEED: z.string().optional(),
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: z.string().optional(),
    NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR: z.string().optional(),
  },
  runtimeEnv: {
    WARGAMING_APPLICATION_ID_EU: process.env.WARGAMING_APPLICATION_ID_EU,
    WARGAMING_APPLICATION_ID_NA: process.env.WARGAMING_APPLICATION_ID_NA,
    WARGAMING_APPLICATION_ID_ASIA: process.env.WARGAMING_APPLICATION_ID_ASIA,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD,
    NEXT_PUBLIC_ADSENSE_SLOT_IN_FEED: process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_FEED,
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
    NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
