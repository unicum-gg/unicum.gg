import { Unicum } from "@unicum.gg/sdk";

/**
 * Shared frontend client for our own public API. The SDK's default base URL is
 * `${APP_IDENTITY.URL}/api` (from `NEXT_PUBLIC_APP_URL`), so it targets the
 * right origin in every environment (dev server locally, `unicum.gg` in prod)
 * for both client and server components without any per-call config.
 *
 * Use it via the region entry point: `unicum.region(region).clans(tag).members()`.
 */
export const unicum = new Unicum();
