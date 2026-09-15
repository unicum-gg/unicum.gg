/**
 * Bound how long a caller WAITS, without cancelling what it waited for.
 *
 * The work keeps running and still writes what it fetched, so the next caller
 * finds it warm. What the deadline ends is the caller's hold on memory, and
 * that is the part that matters: on 2026-09-15 a player-detail request ran for
 * 1373 seconds (23 minutes) holding its whole payload, which exhausted the V8
 * heap and took every web worker down with it. Cloudflare had already cut the
 * connection at 100s, so nobody was still listening for the answer we were
 * killing ourselves to produce.
 */

/** Resolves to null once the caller has waited long enough. Unrefs its timer so
 * a pending deadline never holds the process open at shutdown. */
export function expireAfter(ms: number): Promise<null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
  });
}

/**
 * Await `work` for at most `ms`, resolving to null instead of waiting longer.
 *
 * `work` is detached from the race so abandoning the wait never surfaces as an
 * unhandled rejection, and so it runs to completion in the background.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
): Promise<T | null> {
  work.catch(() => {});
  return Promise.race([work, expireAfter(ms)]);
}
