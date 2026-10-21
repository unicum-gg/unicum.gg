/**
 * Umami Cloud identifiers. Public (not secrets): the website id already ships in
 * the tracker snippet. Kept here so the loader (client) and the feedback embed
 * (server) reference one source instead of hardcoding the id twice.
 */
const UMAMI = {
  /** unicum.gg website id in Umami Cloud. */
  WEBSITE_ID: "ddbebdb6-bb2f-4501-bd55-037e2410b943",
  /** Umami Cloud workspace region slug (part of the dashboard path, not a WoT
   * region). */
  CLOUD_REGION: "eu",
  /** Global the loader stashes the visitor's captured session id on. */
  SESSION_GLOBAL: "__umamiSessionId",
  /** Global the tracker calls before every send, named by `data-before-send`.
   * It receives `(type, payload)` and what it returns replaces the payload, so
   * a falsy return cancels the send outright. See `components/script`. */
  BEFORE_SEND_GLOBAL: "__umamiBeforeSend",
  /** Prefix of the tag put on a payload whose page showed headless signals.
   * Plain ASCII with no separator of its own, so the whole tag stays usable as
   * a filter value in the dashboard. */
  BOT_TAG_PREFIX: "bot-",
  /** Dashboard URL scoped to one visitor session. */
  sessionUrl(sessionId: string): string {
    return `https://cloud.umami.is/analytics/${UMAMI.CLOUD_REGION}/websites/${UMAMI.WEBSITE_ID}/sessions?session=${sessionId}`;
  },
} as const;

export default UMAMI;
