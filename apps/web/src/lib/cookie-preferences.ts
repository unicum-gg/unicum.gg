/**
 * Reopen the cookie banner, from anywhere.
 *
 * The banner listens for this on `window`, so a caller needs to know neither
 * how consent is stored nor whether the banner is currently showing. It is the
 * footer's "Manage cookies", and it is the only way back to the choices once
 * they have been made: the banner hides itself for good after an answer.
 *
 * Nothing to reopen in a development build: the analytics scripts only render
 * in production, so there is no consent to revoke, though the banner itself
 * still opens.
 */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("reopen-cookie-consent"));
}
