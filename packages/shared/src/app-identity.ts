import pkg from "../package.json";
import { env } from "./env";

/**
 * Minimal app identity used for outbound bot headers (User-Agent + contact).
 * The web app's richer `constants/app` (SEO/metadata) stays in `apps/web`.
 *
 * `env.NEXT_PUBLIC_APP_URL` is a client var (see `./env`), so reading it here is
 * safe even when this module is pulled into a browser bundle via `bot-headers`.
 */
export const APP_IDENTITY = {
  NAME: "unicum.gg",
  VERSION: pkg.version,
  URL: env.NEXT_PUBLIC_APP_URL,
  CONTACT_EMAIL: "contact@unicum.gg",
  /** `owner/name` of the public repository. Its commit log is what the
   * changelog is written from, and the web's GitHub link points at it. */
  REPO: "unicum-gg/unicum.gg",
  /** `owner/name` of the client mod's own repository.
   *
   * Here rather than in the web's `constants/app` (which also names it, for the
   * download buttons) because the worker needs it too: the mod's changelog is
   * read from that repository's releases, and a slug written down twice is two
   * answers waiting to disagree the day the repo moves. */
  MOD_REPO: "unicum-gg/unicum.gg-mod",
};

export default APP_IDENTITY;
