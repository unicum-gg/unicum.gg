import pkg from "../package.json";
import { env } from "./env";

/**
 * Minimal app identity used for outbound bot headers (User-Agent + contact).
 * The web app's richer `constants/app` (SEO/metadata) stays in `apps/web`.
 *
 * `env.NEXT_PUBLIC_APP_URL` is a client var (see `./env`), so reading it here is
 * safe even when this module is pulled into a browser bundle via `bot-headers`.
 */
const APP_IDENTITY = {
  NAME: "unicum.gg",
  VERSION: pkg.version,
  URL: env.NEXT_PUBLIC_APP_URL,
  CONTACT_EMAIL: "contact@unicum.gg",
};

export default APP_IDENTITY;
