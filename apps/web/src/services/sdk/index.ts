import { Unicum } from "@unicum.gg/sdk";
import { env } from "../../../env";

/**
 * Shared frontend client for our own public API. The base URL is env-driven and
 * split by environment:
 *
 * - **Browser** → `NEXT_PUBLIC_UNICUM_API_URL`, or the SDK default (relative
 *   `/api`, same-origin, no CORS) when unset.
 * - **Server** (SSR/ISR) → `UNICUM_API_URL`, or the SDK default
 *   (`${NEXT_PUBLIC_APP_URL}/api`) when unset. In prod set it to the loopback
 *   (`http://127.0.0.1:${PORT}/api`) so renders hit the same container
 *   in-process instead of hairpinning out through the public domain/CDN.
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

// Pick the base per environment; `undefined` lets the SDK apply its own default
// (browser → relative `/api`, server → `${NEXT_PUBLIC_APP_URL}/api`). The server
// var is only read on the server branch, so env-nextjs never surfaces it to the
// client. During `next build` the loopback dispatcher above short-circuits fetch
// entirely, so the server base need not be reachable then.
const baseUrl =
  typeof window === "undefined"
    ? env.UNICUM_API_URL
    : env.NEXT_PUBLIC_UNICUM_API_URL;

export const unicum = new Unicum({ fetch: dispatchingFetch, baseUrl });

/**
 * Public-origin client for building **OG image URLs** (`unicum.og.eu.players("x")
 * .url()`). These URLs are rendered into HTML / embeds and loaded by a browser or
 * Discord, so they must use the SDK default base — the public origin on the
 * server, a same-origin relative `/api` in the browser — never the loopback /
 * internal container the data `unicum` above points at. `.url()` is
 * side-effect-free, so this never fetches.
 */
export const unicumPublic = new Unicum();

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

/**
 * A page's decorative data: rendered when it arrives in time, dropped when it
 * does not. `buildSafe` deliberately propagates runtime errors so a failed
 * revalidation keeps the last good page, which is right for data the page is
 * *about*. It is wrong for an ornament, because it also propagates runtime
 * *slowness*: nothing bounds how long an SDK call may take, so one slow
 * upstream can hold a render open indefinitely.
 *
 * That is not theoretical. The home page's live-streamers rail needs a clan
 * lookup that goes out to Wargaming, and the EU lane of that API is rate
 * limited and shared with the background refresh crawl. On 2026-09-03 the queue
 * behind it reached seventeen minutes, so every home render sat waiting on a
 * card that shows nothing at all most of the time, and the page read as down
 * while every other route answered in milliseconds.
 *
 * The deadline is therefore a property of the *caller*, not of the endpoint:
 * this page would rather ship without the rail than not ship.
 */
export async function optional<T>(
  fetcher: () => Promise<T>,
  empty: T,
  ms = 2_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetcher(),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[sdk] optional fetch exceeded ${ms}ms, rendering without it`);
          resolve(empty);
        }, ms);
      }),
    ]);
  } catch (err) {
    console.warn("[sdk] optional fetch failed, rendering without it:", err);
    return empty;
  } finally {
    clearTimeout(timer);
  }
}
