"use client";

/**
 * Coming back to where you were after connecting an account.
 *
 * Connecting leaves the site (Wargaming, then Twitch or Discord), so the dialog
 * is gone by the time the reader returns. With a page there was an address to
 * land on; with a dialog there is only the page they were standing on, so the
 * flag rides the URL and the dialog in the top bar reads it and reopens itself.
 *
 * A query param rather than sessionStorage, because the round trip passes
 * through two redirects and a server-side resume point that may itself bounce
 * through the Wargaming login: the URL is the one thing that survives all of
 * it, and it is also what makes the state inspectable when a step goes wrong.
 */
export const CONNECTIONS_PARAM = "connections";

/** Where an OAuth round trip should land: this page, with the dialog reopened. */
export function returnHere(): string {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  url.searchParams.set(CONNECTIONS_PARAM, "1");
  return `${url.pathname}${url.search}`;
}

/**
 * Whether this page was asked to reopen the dialog, clearing the flag as it
 * answers.
 *
 * Cleared immediately, and with `replaceState` rather than a navigation: the
 * param is a one-shot instruction, and left in place it would reopen the dialog
 * on every reload and ride along into anything the reader shares.
 */
export function consumeConnectionsFlag(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(CONNECTIONS_PARAM)) return false;
  url.searchParams.delete(CONNECTIONS_PARAM);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}
