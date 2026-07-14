import { Unicum } from "@unicum.gg/sdk";
import { env } from "../../../env.js";

/**
 * Shared SDK client for the bot's slash commands: the `/player` and `/clan`
 * responses fetch their data from our own public API (dogfooding the same
 * endpoints the site uses), which also handles the cold-DB case (live WG fetch +
 * snapshot record) server-side.
 *
 * `UNICUM_API_URL` points it at the internal API container in prod so calls stay
 * on the Coolify private network; unset falls back to the SDK default (the
 * public `NEXT_PUBLIC_APP_URL`), used in local dev.
 */
export const unicum = new Unicum(
  env.UNICUM_API_URL ? { baseUrl: env.UNICUM_API_URL } : {},
);
