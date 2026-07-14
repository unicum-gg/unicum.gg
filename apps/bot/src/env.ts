import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * The bot's own env — its Discord application credentials — validated at boot so
 * a missing token fails fast with a clear error instead of a cryptic Discord
 * one. The shared data vars (`DATABASE_URL`, `WARGAMING_APPLICATION_ID_*`,
 * `NEXT_PUBLIC_APP_URL`) are validated separately by `@unicum.gg/shared/env`.
 */
export const env = createEnv({
  server: {
    DIXT_APPLICATION_ID: z.string(),
    DIXT_BOT_TOKEN: z.string(),
    DIXT_APPLICATION_NAME: z.string().optional(),
    // Base URL the SDK calls for command data. In prod, point this at the
    // internal API container (Coolify private network) so requests stay on the
    // local network. Unset falls back to the SDK default (derived from the
    // public `NEXT_PUBLIC_APP_URL`), which is what local dev uses.
    UNICUM_API_URL: z.string().optional(),
  },
  runtimeEnv: {
    DIXT_APPLICATION_ID: process.env.DIXT_APPLICATION_ID,
    DIXT_BOT_TOKEN: process.env.DIXT_BOT_TOKEN,
    DIXT_APPLICATION_NAME: process.env.DIXT_APPLICATION_NAME,
    UNICUM_API_URL: process.env.UNICUM_API_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
