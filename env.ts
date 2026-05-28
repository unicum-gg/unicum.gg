import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    WARGAMING_APPLICATION_ID: z.string(),
  },
  client: {},
  runtimeEnv: {
    WARGAMING_APPLICATION_ID: process.env.WARGAMING_APPLICATION_ID,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
