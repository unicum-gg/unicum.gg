import pkg from "../package.json";
import { env } from "./env";

/**
 * Minimal app identity used for outbound bot headers (User-Agent + contact).
 * The web app's richer `constants/app` (SEO/metadata) stays in `apps/web`.
 */
const APP_IDENTITY = {
  NAME: "unicum.gg",
  VERSION: pkg.version,
  URL: env.NEXT_PUBLIC_APP_URL,
  CONTACT_EMAIL: "contact@unicum.gg",
};

export default APP_IDENTITY;
