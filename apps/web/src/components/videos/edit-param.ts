import { createNumericParamStore } from "@/lib/url-param-store";

/**
 * The suggestion being corrected, in the URL.
 *
 * It has to be openable from a link, since a moderator reaches the dialog from
 * a button in Discord, and holding that truth twice would mean an effect
 * pushing the param into state.
 *
 * The moderator's token rides in the FRAGMENT rather than the query string, and
 * that is not cosmetic: a fragment is never sent to a server, and the query
 * string is. Umami is loaded on every production page without
 * `data-exclude-search`, so a token in the query would be posted to
 * `cloud.umami.is` with the pageview (and to GA4 for a reader who accepted
 * cookies), where a live 30-minute credential for one row would sit in someone
 * else's logs. It is dropped from the URL on any write, so it never outlives
 * the row it was minted for.
 */
export const EDIT_PARAM = "edit";
export const EDIT_TOKEN_KEY = "token";

const store = createNumericParamStore(EDIT_PARAM, { clearHashOnWrite: true });

export const subscribeToEditParam = store.subscribe;
export const readEditParam = store.read;
export const writeEditParam = store.write;

/** Only ever read beside an id: a token on its own addresses nothing. */
export function readEditToken(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash).get(EDIT_TOKEN_KEY);
}
