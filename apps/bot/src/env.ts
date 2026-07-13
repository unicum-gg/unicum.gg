import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * The bot's own env — its Discord application credentials — validated at boot so
 * a missing token fails fast with a clear error instead of a cryptic Discord
 * one. The shared data vars (`DATABASE_URL`, `WARGAMING_APPLICATION_ID_*`,
 * `NEXT_PUBLIC_APP_URL`) are validated separately by `@unicum.gg/core/env`.
 */
export const env = createEnv({
  server: {
    DIXT_APPLICATION_ID: z.string(),
    DIXT_BOT_TOKEN: z.string(),
    DIXT_APPLICATION_NAME: z.string().optional(),
  },
  runtimeEnv: {
    DIXT_APPLICATION_ID: process.env.DIXT_APPLICATION_ID,
    DIXT_BOT_TOKEN: process.env.DIXT_BOT_TOKEN,
    DIXT_APPLICATION_NAME: process.env.DIXT_APPLICATION_NAME,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
