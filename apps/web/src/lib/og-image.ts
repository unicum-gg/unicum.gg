/**
 * One of our own OG card URLs as a same-origin path.
 *
 * The SDK's URL builder returns whatever suits the reader of the URL: the
 * public absolute form on the server (those URLs end up in `<meta>` tags and in
 * Discord embeds, which need a domain) and a relative one in the browser. A
 * component that renders the card itself wants neither of those halves: an
 * absolute URL makes `next/image` treat our own route as a remote host, and the
 * two forms differ between the server pass and hydration, which is a mismatch on
 * an `src`.
 *
 * The query survives, because some cards live in it (a comparison card is
 * `/api/og/eu/players/compare?names=…`).
 */
export function ogImagePath(url: string): string {
  try {
    // The base only serves to parse an already-relative input; it is dropped.
    const parsed = new URL(url, "http://og.local");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
