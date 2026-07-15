import { Unicum } from "@unicum.gg/sdk";

/**
 * Shared frontend client for our own public API. The SDK's default base URL is
 * `${APP_IDENTITY.URL}/api` (from `NEXT_PUBLIC_APP_URL`), so it targets the
 * right origin in every environment (dev server locally, `unicum.gg` in prod)
 * for both client and server components without any per-call config.
 *
 * Use it via the region entry point: `unicum.region(region).clans(tag).members()`.
 */
// During `next build`, `services/sdk/loopback.ts` (imported by the root
// layout, server graph only) installs an in-process dispatcher on this global
// so prerendered pages resolve their SDK calls against this build's own route
// handlers instead of the deployed API. Resolved at call time: this module is
// also bundled client-side, where the global never exists and plain fetch is
// used.
const dispatchingFetch: typeof fetch = (input, init) => {
  const impl =
    (globalThis as { __unicumLoopbackFetch?: typeof fetch })
      .__unicumLoopbackFetch ?? fetch;
  return impl(input, init);
};

export const unicum = new Unicum({ fetch: dispatchingFetch });

const BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Build-time safety net for ISR pages. With the loopback above, prerendered
 * pages get real data from the in-process handlers; this fallback only kicks
 * in when even that fails (e.g. a build environment with no database, like a
 * contributor's machine). The page then prerenders as an empty shell and heals
 * on its first revalidation. At runtime the error propagates, so a failed
 * background revalidation keeps serving the last good page.
 */
export async function buildSafe<T>(
  fetcher: () => Promise<T>,
  empty: T,
): Promise<T> {
  if (!BUILD_PHASE) return fetcher();
  try {
    return await fetcher();
  } catch (err) {
    console.warn("[sdk] build-time fetch failed, prerendering empty:", err);
    return empty;
  }
}
