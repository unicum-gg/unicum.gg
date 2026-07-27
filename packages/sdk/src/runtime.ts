import {
  APP_IDENTITY,
  type LiveStreamer,
  type OnlinePayload,
  type SearchSource,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { Client } from "openapi-fetch";
import type { paths } from "./generated/schema";

/** SSE payload types, re-exported so the generated client types its live
 * subscriptions without reaching into `@unicum.gg/shared` itself. */
export type { LiveStreamer, OnlinePayload };

/**
 * Hand-written runtime for the fluent client. Everything here is stable
 * infrastructure — the lazy request handle, URL building, date revival, the SSE
 * and NDJSON transports, and the shared types — that the fluent client
 * (`client.ts`) builds on. Only the plain REST methods inside `client.ts`'s
 * `// #region generated` blocks come from the OpenAPI spec; this core is not.
 */

/**
 * Default API base URL, resolved per environment so the client always hits the
 * right origin without a hardcoded domain:
 *
 * - In the **browser**, a relative `/api` keeps every call same-origin.
 * - On the **server** (SSR / Node), an absolute URL from `APP_IDENTITY.URL`.
 *
 * Override per client via `new Unicum({ baseUrl })`.
 */
export const UNICUM_API_URL =
  typeof window === "undefined" ? `${APP_IDENTITY.URL}/api` : "/api";

export type UnicumOptions = {
  /** API base URL. Defaults to the production API; point it at a dev server for
   * local work (e.g. `http://localhost:3000/api`). */
  baseUrl?: string;
  /** Custom fetch implementation (e.g. a proxy or a test double). */
  fetch?: typeof fetch;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
};

/** Thrown when the API returns a non-2xx response. */
export class UnicumError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: unknown,
  ) {
    super(`${APP_IDENTITY.NAME} API request to ${url} failed with ${status}`);
    this.name = "UnicumError";
  }
}

type Get<P extends keyof paths> = paths[P] extends { get: infer G } ? G : never;
export type QueryOf<P extends keyof paths> = Get<P> extends {
  parameters: { query?: infer Q };
}
  ? Q
  : undefined;

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Recursively revive ISO-8601 date-time strings into `Date`, so responses match
 * the `date-time → Date` typing of the generated schema. Walks in place; the
 * payload is freshly parsed and owned by us. The full-timestamp regex means
 * plain identifiers (nicknames, tags, slugs) are never mistaken for dates.
 */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_DATE_TIME.test(value) ? new Date(value) : value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = reviveDates(value[i]);
    return value;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = reviveDates(record[key]);
    return value;
  }
  return value;
}

async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok || error !== undefined) {
    throw new UnicumError(response.status, response.url, error ?? data);
  }
  return reviveDates(data) as T;
}

/**
 * The result of a data endpoint call. It is a `PromiseLike<T>`, so `await`,
 * `Promise.all`, and SWR/React `use` treat it exactly like the promise it used
 * to be — but it also carries `.url()`, the request's target URL, so a cache key
 * can be derived from the same call instead of hand-built (and can never drift
 * from what the SDK actually fetches).
 *
 * Execution is lazy: the underlying request fires on `await`/`.then()`, not when
 * the method is called, so reading `.url()` has no side effect.
 */
export class RequestHandle<T> implements PromiseLike<T> {
  constructor(
    private readonly _url: string,
    private readonly run: () => Promise<T>,
  ) {}

  /** The URL this request targets (absolute on the server, same-origin relative
   * in the browser). Side-effect-free; does not fire the request. */
  url(): string {
    return this._url;
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run().then(onFulfilled, onRejected);
  }

  catch<R = never>(
    onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null,
  ): Promise<T | R> {
    return this.run().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<T> {
    return this.run().finally(onFinally);
  }

  get [Symbol.toStringTag](): string {
    return "RequestHandle";
  }
}

/**
 * Build the URL an openapi-fetch call targets: substitute `{param}` path holders
 * and append a flat query string. Matches openapi-fetch's default serialization
 * for our endpoints, so `.url()` lines up with the request that actually goes out.
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams?: Record<string, string | number>,
  query?: Record<string, unknown>,
): string {
  let built = path;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      built = built.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }
  const search = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return `${baseUrl}${built}${qs ? `?${qs}` : ""}`;
}

/**
 * Wrap a deferred openapi-fetch call as a `RequestHandle`. The `call` thunk is
 * only invoked when the handle is awaited, keeping `.url()` side-effect-free.
 */
export function handle<T>(
  url: string,
  call: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): RequestHandle<T> {
  return new RequestHandle(url, () => unwrap(call()));
}

/** Cancels an SSE subscription; call it to close the underlying `EventSource`. */
export type Unsubscribe = () => void;

/** Payload of a clan/player live `"update"` event: a hint at what changed so the
 * client can refetch just that slice. `kind` is `undefined` for a generic
 * "something changed" signal. */
export type LiveUpdate = { kind?: string };

/**
 * Subscribe to a Server-Sent Events stream, parsing each event's JSON `data`
 * into `T`. Browser-only: on the server there is no `EventSource`, so it is a
 * harmless no-op returning a no-op unsubscribe. `EventSource` auto-reconnects on
 * transient errors, so `onError` is advisory (the stream stays open).
 */
export function subscribeSse<T>(
  url: string,
  event: string,
  onData: (data: T) => void,
  onError?: (error: Event) => void,
): Unsubscribe {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }
  const source = new EventSource(url);
  source.addEventListener(event, (e) => {
    try {
      onData(JSON.parse((e as MessageEvent).data) as T);
    } catch {
      // ignore malformed payloads
    }
  });
  if (onError) source.onerror = onError;
  return () => source.close();
}

/**
 * One NDJSON line of a streamed search: a batch of results tagged by where they
 * came from. The `local` chunk (our DB) arrives first and near-instantly; the
 * `remote` chunk (deduped Wargaming hits) follows once the rate-limited WG call
 * returns — which is why the streamed variant paints faster than `search()`.
 */
export type SearchChunk<T> = { source: SearchSource; results: T[] };

/** Options for a streamed search. */
export type SearchStreamOptions = {
  /** Abort the stream, e.g. when the query changes. The pending request rejects
   * with an `AbortError`, which the generator propagates. */
  signal?: AbortSignal;
};

/**
 * Stream an NDJSON endpoint, yielding each line parsed (and date-revived) as `T`.
 * Works in the browser and Node (both stream `Response.body`).
 */
export async function* streamNdjson<T>(
  url: string,
  fetchImpl: typeof fetch,
  headers: Record<string, string> | undefined,
  signal: AbortSignal | undefined,
): AsyncGenerator<T> {
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: "application/x-ndjson", ...headers },
  });
  if (!response.ok || !response.body) {
    throw new UnicumError(response.status, response.url, undefined);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (line: string): T => reviveDates(JSON.parse(line)) as T;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield parse(line);
      }
    }
    const tail = buffer.trim();
    if (tail) yield parse(tail);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** The success (`200`) JSON body type of a GET endpoint, for consumers that
 * want to name a response type. */
export type Data<P extends keyof paths> = Get<P> extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;

/** The item type of a `/search` endpoint's `results`, reused to type its
 * streamed (`/search/ndjson`) chunks. */
export type SearchItemOf<P extends keyof paths> = Data<P> extends {
  results: readonly (infer I)[];
}
  ? I
  : never;

/** The openapi-fetch client type, re-exported so the generated client can type
 * its private `api` field without re-importing openapi-fetch. */
export type ApiClient = Client<paths>;

/**
 * Stream one of the `/search/ndjson` endpoints, yielding each NDJSON line as a
 * `SearchChunk<T>` (the `local` DB chunk first, then the `remote` Wargaming
 * chunk). Shared by every namespace's `searchStream()`, which only differs by
 * `resource` and the item type `T`.
 */
export function ndjsonSearch<T>(
  baseUrl: string,
  region: Region,
  fetchImpl: typeof fetch,
  headers: Record<string, string> | undefined,
  resource: "players" | "clans" | "tanks",
  q: string,
  signal?: AbortSignal,
): AsyncGenerator<SearchChunk<T>> {
  return streamNdjson<SearchChunk<T>>(
    `${baseUrl}/${region}/${resource}/search/ndjson?q=${encodeURIComponent(q)}`,
    fetchImpl,
    headers,
    signal,
  );
}

/**
 * The SSE subscriptions the generated client delegates to. They live here (not
 * in the generated file) because building an `EventSource` URL needs a template
 * literal — the one bit of per-endpoint logic the spec can't express — so the
 * generated client stays pure structure calling these.
 */
export function subscribePlayerLive(
  baseUrl: string,
  region: Region,
  nickname: string,
  onUpdate: (event: LiveUpdate) => void,
  onError?: (error: Event) => void,
): Unsubscribe {
  return subscribeSse(
    `${baseUrl}/${region}/players/${encodeURIComponent(nickname)}/sse`,
    "update",
    onUpdate,
    onError,
  );
}

export function subscribeClanLive(
  baseUrl: string,
  region: Region,
  tag: string,
  onUpdate: (event: LiveUpdate) => void,
  onError?: (error: Event) => void,
): Unsubscribe {
  return subscribeSse(
    `${baseUrl}/${region}/clans/${encodeURIComponent(tag)}/sse`,
    "update",
    onUpdate,
    onError,
  );
}

export function subscribeServerOnline(
  baseUrl: string,
  region: Region,
  onData: (payload: OnlinePayload) => void,
  onError?: (error: Event) => void,
): Unsubscribe {
  return subscribeSse<OnlinePayload>(
    `${baseUrl}/${region}/server/online/sse`,
    "message",
    onData,
    onError,
  );
}

export function subscribeStreamersLive(
  baseUrl: string,
  onData: (streamers: LiveStreamer[]) => void,
  onError?: (error: Event) => void,
): Unsubscribe {
  return subscribeSse<LiveStreamer[]>(
    `${baseUrl}/streamers/live/sse`,
    "message",
    onData,
    onError,
  );
}
