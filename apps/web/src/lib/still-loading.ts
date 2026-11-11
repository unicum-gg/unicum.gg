import { UnicumError } from "@unicum.gg/sdk";

/**
 * The two entity endpoints answer 503 `still_loading` when the assembly they
 * kicked off has not finished: the admission gate had no slot, or the cold
 * deadline passed. It is not a failure, and `Retry-After` says so, but a page
 * that lets it reach its error boundary renders "something went wrong" and
 * blames Wargaming for what our own gate did.
 *
 * Measured in production on 2026-11-11, over one window of the web log: 843
 * requests served, 73 failures, every one of them this, and zero event-loop
 * stalls. The process was keeping up; the gate was shedding, and the reader
 * was told the site was broken.
 *
 * **The page cannot answer with a placeholder**, which is what makes this a
 * digest rather than a rendered state. Both entity pages are `force-static`,
 * so anything they return is written to the ISR cache: a "loading" body would
 * be served to everyone for the page's whole revalidate window, where the
 * throw is cached by nothing. So the page rethrows, and the boundary, which
 * runs on the client and is never cached, is what waits and asks again.
 *
 * In production Next replaces a server error's message with a generic one and
 * keeps only the digest, so the digest is the only thing that can carry the
 * distinction across. A digest the thrower sets is passed through untouched
 * (`create-error-handler.js`: "If the error already has a digest, respect the
 * original digest"), which is what this relies on.
 */
export const STILL_LOADING_DIGEST = "unicum:still-loading";

/** What the endpoints send as `Retry-After` and what the boundary waits before
 * asking again, so the two cannot drift apart. */
export const STILL_LOADING_RETRY_SECONDS = 5;

/**
 * How many times the boundary asks again before giving up and showing the
 * error it would have shown immediately.
 *
 * Retrying is the designed path rather than extra load: the request that was
 * refused STARTED the assembly, and the endpoint re-reads the cache before it
 * reaches the gate again, so the second ask usually lands on what the first
 * one set going. Bounded anyway, because an account Wargaming is slow about
 * must not leave a reader polling for ever.
 */
export const STILL_LOADING_ATTEMPTS = 4;

/** Whether this is the endpoint saying "ask again", rather than a failure. */
export function isStillLoading(error: unknown): boolean {
  if (!(error instanceof UnicumError) || error.status !== 503) return false;
  const body = error.body as { error?: string } | null;
  return body?.error === "still_loading";
}

/**
 * Mark a caught `still_loading` so the boundary can recognise it, and throw.
 *
 * The original is kept as the cause, so the server log still carries what
 * actually happened rather than the sentinel alone.
 */
export function throwStillLoading(error: unknown): never {
  const marked = new Error("still_loading", { cause: error }) as Error & {
    digest: string;
  };
  marked.digest = STILL_LOADING_DIGEST;
  throw marked;
}
