import APP from "@/constants/app";
import type { Region } from "@/services/wargaming/wot";

/**
 * Identification headers attached to every outbound HTTP request so
 * upstream services (Wargaming, G-Core CDN, tomato.gg) see a clearly named
 * bot rather than a generic `node`/`curl` signature:
 *
 * - `user-agent`: Googlebot-style `name/region/version (+url)` — the marker
 *   WAFs look for to classify a request as an identified bot.
 * - `from`: contact email per RFC 9309, so an admin can reach the operator
 *   if the bot causes problems (excessive requests, accessing restricted
 *   paths, etc.) before resorting to outright blocking.
 * - `accept-language: en`: anti-bot WAFs flag requests with missing or
 *   mismatched Accept-Language as suspicious. We're English-only so this
 *   is a stable, honest signal.
 *
 * Region is optional: include it for Wargaming/portal calls (per-region
 * rate limits), omit for global services (tomato.gg, modxvm).
 */
export function botHeaders(region?: Region): Record<string, string> {
  const product = region
    ? `${APP.NAME}/${region}/${APP.VERSION}`
    : `${APP.NAME}/${APP.VERSION}`;
  return {
    "user-agent": `${product} (+${APP.URL})`,
    from: APP.CONTACT.EMAIL,
    "accept-language": "en",
  };
}
