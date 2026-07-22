import { APP_IDENTITY, type SearchSource, type LiveStreamer, type OnlinePayload } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema";

/**
 * Default API base URL, resolved per environment so the client always hits the
 * right origin without a hardcoded domain:
 *
 * - In the **browser**, a relative `/api` keeps every call same-origin. This
 *   avoids CORS entirely and doesn't care whether the page is served from
 *   `localhost`, the `127.0.0.1` loopback, or `unicum.gg` (an absolute
 *   `NEXT_PUBLIC_APP_URL` would mismatch the host the user is actually on).
 * - On the **server** (SSR / Node), relative fetch has no base, so we derive an
 *   absolute URL from `APP_IDENTITY.URL` (`NEXT_PUBLIC_APP_URL`).
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
type QueryOf<P extends keyof paths> = Get<P> extends {
  parameters: { query?: infer Q };
}
  ? Q
  : undefined;

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Recursively revive ISO-8601 date-time strings into `Date`, so responses match
 * the `date-time → Date` typing of the generated schema (openapi-fetch returns
 * raw JSON, where dates are strings). Walks in place; the payload is freshly
 * parsed and owned by us. The full-timestamp regex means plain identifiers
 * (nicknames, tags, slugs) are never mistaken for dates.
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

  // With `then`/`catch`/`finally` above, this makes `RequestHandle<T>`
  // structurally a `Promise<T>`, so it stays a drop-in wherever a `Promise` is
  // expected (helpers like `buildSafe`, `Promise.all`, `React.use`).
  get [Symbol.toStringTag](): string {
    return "RequestHandle";
  }
}

/**
 * Build the URL an openapi-fetch call targets: substitute `{param}` path holders
 * and append a flat query string. Matches openapi-fetch's default serialization
 * for our endpoints (simple path params + scalar/comma-joined query values), so
 * `.url()` lines up with the request that actually goes out.
 */
function buildUrl(
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
 * `T` is inferred from the call's `data`, so callers keep full response typing.
 */
function handle<T>(
  url: string,
  call: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): RequestHandle<T> {
  return new RequestHandle(url, () => unwrap(call()));
}

/** Cancels an SSE subscription; call it to close the underlying `EventSource`
 * (e.g. from a React effect cleanup). */
export type Unsubscribe = () => void;

/** Payload of a clan/player live `"update"` event: a hint at what changed so the
 * client can refetch just that slice. `kind` is `undefined` for a generic
 * "something changed" signal. */
export type LiveUpdate = { kind?: string };

/**
 * Subscribe to a Server-Sent Events stream, parsing each event's JSON `data`
 * into `T`. Browser-only: on the server (SSR / Node) there is no `EventSource`,
 * so it is a harmless no-op returning a no-op unsubscribe. The returned function
 * closes the stream. `EventSource` auto-reconnects on transient errors, so
 * `onError` is advisory (the stream stays open).
 */
function subscribeSse<T>(
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
async function* streamNdjson<T>(
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
    // Runs on early exit too (a consumer `break`ing after the first chunk),
    // closing the HTTP stream instead of leaving it open until GC.
    await reader.cancel().catch(() => {});
  }
}

/** The item type of a `/search` endpoint's `results`, reused to type its
 * streamed (`/search/ndjson`) chunks. */
type SearchItemOf<P extends keyof paths> = Data<P> extends {
  results: readonly (infer I)[];
}
  ? I
  : never;

/** A single player: `unicum.eu.players("Rice")`. */
class PlayerClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly baseUrl: string,
    private readonly region: Region,
    private readonly nickname: string,
  ) {}

  /** Full player detail (profile, overall stats, periods, derived, vehicles,
   * rating history, clan history, strongholds). Pass `{ metric }` to pin the
   * rating metric that drives `liftDrag` and `ratingHistory`. */
  detail(query?: QueryOf<"/{region}/players/{nickname}">) {
    const path = { region: this.region, nickname: this.nickname };
    return handle(
      buildUrl(this.baseUrl, "/{region}/players/{nickname}", path, query),
      () =>
        this.api.GET("/{region}/players/{nickname}", { params: { path, query } }),
    );
  }

  /** The player's per-tank rows (tank-by-tank breakdown with per-battle
   * averages and WN7/WN8/WNX ratings). The heavy list, loaded on demand
   * separately from `detail()`. */
  tanks() {
    const path = { region: this.region, nickname: this.nickname };
    return handle(
      buildUrl(this.baseUrl, "/{region}/players/{nickname}/tanks", path),
      () =>
        this.api.GET("/{region}/players/{nickname}/tanks", { params: { path } }),
    );
  }

  /** The player's current clan (tag, name, color) from cached data only, no
   * live Wargaming call. Null when not in a clan or not yet tracked. A cheap
   * alternative to `detail()` for compact UI like nav bars. */
  clan() {
    const path = { region: this.region, nickname: this.nickname };
    return handle(
      buildUrl(this.baseUrl, "/{region}/players/{nickname}/clan", path),
      () =>
        this.api.GET("/{region}/players/{nickname}/clan", { params: { path } }),
    );
  }

  /** Enqueue an on-demand refresh of this player; returns the estimated seconds
   * until it completes. */
  enqueue() {
    const path = { region: this.region, nickname: this.nickname };
    return handle(
      buildUrl(this.baseUrl, "/{region}/players/{nickname}/enqueue", path),
      () =>
        this.api.POST("/{region}/players/{nickname}/enqueue", {
          params: { path },
        }),
    );
  }

  /** Subscribe to live updates for this player (SSE): `onUpdate` fires when
   * fresh stats land server-side, so refetch `detail()` in response. Returns an
   * unsubscribe function; browser-only. */
  live(
    onUpdate: (event: LiveUpdate) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe {
    const { region, nickname } = this;
    return subscribeSse(
      `${this.baseUrl}/${region}/players/${encodeURIComponent(nickname)}/sse`,
      "update",
      onUpdate,
      onError,
    );
  }
}

type PlayersNamespace = ((nickname: string) => PlayerClient) & {
  /** Combined (non-streamed) player search by nickname prefix. */
  search(q: string): RequestHandle<Data<"/{region}/players/search">>;
  /** Streamed player search: an async iterator of NDJSON chunks (local DB hits
   * first, then Wargaming), so results paint progressively. */
  searchStream(
    q: string,
    options?: SearchStreamOptions,
  ): AsyncGenerator<SearchChunk<SearchItemOf<"/{region}/players/search">>>;
  /** Player leaderboard for the region. Pass `{ language }` for the
   * by-language board (lifetime WNX). */
  top(
    query?: QueryOf<"/{region}/players/top">,
  ): RequestHandle<Data<"/{region}/players/top">>;
  /** Languages the region's tracked players speak, with populations. */
  languages(): RequestHandle<Data<"/{region}/players/languages">>;
  /** Side-by-side comparison inputs for up to 4 players. */
  compare(names: string[]): RequestHandle<Data<"/{region}/players/compare">>;
};

/** A single clan: `unicum.eu.clans("FAME")`. */
class ClanClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly baseUrl: string,
    private readonly region: Region,
    private readonly tag: string,
  ) {}

  /** Clan overview: profile + aggregate ratings. */
  overview() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}", path),
      () => this.api.GET("/{region}/clans/{tag}", { params: { path } }),
    );
  }
  /** Members with cached WN7/WN8/WNX ratings. */
  members() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/members", path),
      () => this.api.GET("/{region}/clans/{tag}/members", { params: { path } }),
    );
  }
  /** Clans the members previously belonged to. */
  previousClans() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/previous-clans", path),
      () =>
        this.api.GET("/{region}/clans/{tag}/previous-clans", {
          params: { path },
        }),
    );
  }
  /** Recent join / leave / role-change events. */
  activity() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/activity", path),
      () => this.api.GET("/{region}/clans/{tag}/activity", { params: { path } }),
    );
  }
  /** Stronghold Elo + skirmish/advances (latest + period diffs). */
  stronghold() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/stronghold", path),
      () =>
        this.api.GET("/{region}/clans/{tag}/stronghold", { params: { path } }),
    );
  }
  /** Global Map (Clan Wars) stats (latest + period diffs). */
  clanWars() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/clan-wars", path),
      () =>
        this.api.GET("/{region}/clans/{tag}/clan-wars", { params: { path } }),
    );
  }
  /** Per-tank aggregates across all members. */
  vehicles() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/vehicles", path),
      () => this.api.GET("/{region}/clans/{tag}/vehicles", { params: { path } }),
    );
  }

  /** Enqueue an on-demand refresh of this clan; returns the estimated seconds
   * until it completes. */
  enqueue() {
    const path = { region: this.region, tag: this.tag };
    return handle(
      buildUrl(this.baseUrl, "/{region}/clans/{tag}/enqueue", path),
      () =>
        this.api.POST("/{region}/clans/{tag}/enqueue", { params: { path } }),
    );
  }

  /** Subscribe to live updates for this clan (SSE): `onUpdate` fires when the
   * clan's data changes server-side, so refetch the affected slice in response.
   * Returns an unsubscribe function; browser-only. */
  live(
    onUpdate: (event: LiveUpdate) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe {
    const { region, tag } = this;
    return subscribeSse(
      `${this.baseUrl}/${region}/clans/${encodeURIComponent(tag)}/sse`,
      "update",
      onUpdate,
      onError,
    );
  }
}

type ClansNamespace = ((tag: string) => ClanClient) & {
  /** Combined (non-streamed) clan search by name or tag prefix. */
  search(q: string): RequestHandle<Data<"/{region}/clans/search">>;
  /** Streamed clan search: an async iterator of NDJSON chunks (local DB hits
   * first, then Wargaming), so results paint progressively. */
  searchStream(
    q: string,
    options?: SearchStreamOptions,
  ): AsyncGenerator<SearchChunk<SearchItemOf<"/{region}/clans/search">>>;
  top(
    query?: QueryOf<"/{region}/clans/top">,
  ): RequestHandle<Data<"/{region}/clans/top">>;
  /** Languages the region's clans declare, with populations. */
  languages(): RequestHandle<Data<"/{region}/clans/languages">>;
  /** Stronghold clan leaderboard for one mode/tier. */
  strongholdTop(
    query?: QueryOf<"/{region}/clans/stronghold/top">,
  ): RequestHandle<Data<"/{region}/clans/stronghold/top">>;
  /** Side-by-side comparison inputs for up to 4 clans. */
  compare(tags: string[]): RequestHandle<Data<"/{region}/clans/compare">>;
};

/** A single tank: `unicum.eu.tanks("is-7")`. */
class TankClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly baseUrl: string,
    private readonly region: Region,
    private readonly slug: string,
  ) {}

  /** Server-wide performance for this tank. */
  performance() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}", path),
      () => this.api.GET("/{region}/tanks/{slug}", { params: { path } }),
    );
  }
  /** Everything the tank page renders in one payload (identity, top players,
   * server averages, expected values, specs, MoE/MoM + history, research
   * path). `slug` in the response is the canonical slug. */
  detail() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}/detail", path),
      () => this.api.GET("/{region}/tanks/{slug}/detail", { params: { path } }),
    );
  }
  /** Combat specifications. */
  specifications() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}/specifications", path),
      () =>
        this.api.GET("/{region}/tanks/{slug}/specifications", {
          params: { path },
        }),
    );
  }
  /** Economics (price, ammo cost, research XP). */
  economics() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}/economics", path),
      () =>
        this.api.GET("/{region}/tanks/{slug}/economics", { params: { path } }),
    );
  }
  /** Marks of Excellence thresholds. */
  marksOfExcellence() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}/marks-of-excellence", path),
      () =>
        this.api.GET("/{region}/tanks/{slug}/marks-of-excellence", {
          params: { path },
        }),
    );
  }
  /** Marks of Mastery XP thresholds. */
  marksOfMastery() {
    const path = { region: this.region, slug: this.slug };
    return handle(
      buildUrl(this.baseUrl, "/{region}/tanks/{slug}/marks-of-mastery", path),
      () =>
        this.api.GET("/{region}/tanks/{slug}/marks-of-mastery", {
          params: { path },
        }),
    );
  }
}

type TanksNamespace = ((slug: string) => TankClient) & {
  /** Per-tank server performance for the whole region catalogue. */
  list(): RequestHandle<Data<"/{region}/tanks">>;
  /** Combat specifications for the whole region catalogue. */
  specifications(): RequestHandle<Data<"/{region}/tanks/specifications">>;
  /** Economics for the whole region catalogue. */
  economics(): RequestHandle<Data<"/{region}/tanks/economics">>;
  /** Marks of Excellence thresholds for the whole region catalogue. */
  marksOfExcellence(): RequestHandle<Data<"/{region}/tanks/marks-of-excellence">>;
  /** Marks of Mastery thresholds for the whole region catalogue. */
  marksOfMastery(): RequestHandle<Data<"/{region}/tanks/marks-of-mastery">>;
  /** Vehicle catalogue search by name / short name / tag. */
  search(q: string): RequestHandle<Data<"/{region}/tanks/search">>;
  /** Streamed vehicle search: an async iterator of NDJSON chunks (a single
   * `local` chunk from the in-memory catalogue). */
  searchStream(
    q: string,
    options?: SearchStreamOptions,
  ): AsyncGenerator<SearchChunk<SearchItemOf<"/{region}/tanks/search">>>;
};

type ServerNamespace = {
  /** Live count of players online for this region (SSE). The payload is `null`
   * on a transient upstream failure; keep the last known value. Returns an
   * unsubscribe function; browser-only. */
  online(
    onData: (payload: OnlinePayload) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe;
};

/** Every resource scoped to one region: `unicum.eu`, `unicum.region("na")`. */
class RegionClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch,
    private readonly headers: Record<string, string> | undefined,
    readonly region: Region,
  ) {}

  /** Build a streamed-search generator for one of the `/search/ndjson` endpoints. */
  #searchStream<T>(resource: "players" | "clans" | "tanks", q: string, signal?: AbortSignal) {
    return streamNdjson<T>(
      `${this.baseUrl}/${this.region}/${resource}/search/ndjson?q=${encodeURIComponent(q)}`,
      this.fetchImpl,
      this.headers,
      signal,
    );
  }

  get players(): PlayersNamespace {
    const { api, region, baseUrl } = this;
    const ns = ((nickname: string) =>
      new PlayerClient(api, baseUrl, region, nickname)) as PlayersNamespace;
    ns.search = (q) =>
      handle(
        buildUrl(baseUrl, "/{region}/players/search", { region }, { q }),
        () =>
          api.GET("/{region}/players/search", {
            params: { path: { region }, query: { q } },
          }),
      );
    ns.searchStream = (q, options) =>
      this.#searchStream<SearchChunk<SearchItemOf<"/{region}/players/search">>>(
        "players",
        q,
        options?.signal,
      );
    ns.top = (query) =>
      handle(
        buildUrl(baseUrl, "/{region}/players/top", { region }, query),
        () =>
          api.GET("/{region}/players/top", { params: { path: { region }, query } }),
      );
    ns.languages = () =>
      handle(
        buildUrl(baseUrl, "/{region}/players/languages", { region }),
        () =>
          api.GET("/{region}/players/languages", { params: { path: { region } } }),
      );
    ns.compare = (names) =>
      handle(
        buildUrl(baseUrl, "/{region}/players/compare", { region }, {
          names: names.join(","),
        }),
        () =>
          api.GET("/{region}/players/compare", {
            params: { path: { region }, query: { names: names.join(",") } },
          }),
      );
    return ns;
  }

  get clans(): ClansNamespace {
    const { api, region, baseUrl } = this;
    const ns = ((tag: string) =>
      new ClanClient(api, baseUrl, region, tag)) as ClansNamespace;
    ns.search = (q) =>
      handle(
        buildUrl(baseUrl, "/{region}/clans/search", { region }, { q }),
        () =>
          api.GET("/{region}/clans/search", {
            params: { path: { region }, query: { q } },
          }),
      );
    ns.searchStream = (q, options) =>
      this.#searchStream<SearchChunk<SearchItemOf<"/{region}/clans/search">>>(
        "clans",
        q,
        options?.signal,
      );
    ns.top = (query) =>
      handle(
        buildUrl(baseUrl, "/{region}/clans/top", { region }, query),
        () =>
          api.GET("/{region}/clans/top", { params: { path: { region }, query } }),
      );
    ns.languages = () =>
      handle(
        buildUrl(baseUrl, "/{region}/clans/languages", { region }),
        () =>
          api.GET("/{region}/clans/languages", { params: { path: { region } } }),
      );
    ns.strongholdTop = (query) =>
      handle(
        buildUrl(baseUrl, "/{region}/clans/stronghold/top", { region }, query),
        () =>
          api.GET("/{region}/clans/stronghold/top", {
            params: { path: { region }, query },
          }),
      );
    ns.compare = (tags) =>
      handle(
        buildUrl(baseUrl, "/{region}/clans/compare", { region }, {
          tags: tags.join(","),
        }),
        () =>
          api.GET("/{region}/clans/compare", {
            params: { path: { region }, query: { tags: tags.join(",") } },
          }),
      );
    return ns;
  }

  get tanks(): TanksNamespace {
    const { api, region, baseUrl } = this;
    const ns = ((slug: string) =>
      new TankClient(api, baseUrl, region, slug)) as TanksNamespace;
    const p = { params: { path: { region } } } as const;
    const tanksUrl = (path: string) => buildUrl(baseUrl, path, { region });
    ns.list = () =>
      handle(tanksUrl("/{region}/tanks"), () => api.GET("/{region}/tanks", p));
    ns.specifications = () =>
      handle(tanksUrl("/{region}/tanks/specifications"), () =>
        api.GET("/{region}/tanks/specifications", p),
      );
    ns.economics = () =>
      handle(tanksUrl("/{region}/tanks/economics"), () =>
        api.GET("/{region}/tanks/economics", p),
      );
    ns.marksOfExcellence = () =>
      handle(tanksUrl("/{region}/tanks/marks-of-excellence"), () =>
        api.GET("/{region}/tanks/marks-of-excellence", p),
      );
    ns.marksOfMastery = () =>
      handle(tanksUrl("/{region}/tanks/marks-of-mastery"), () =>
        api.GET("/{region}/tanks/marks-of-mastery", p),
      );
    ns.search = (q) =>
      handle(
        buildUrl(baseUrl, "/{region}/tanks/search", { region }, { q }),
        () =>
          api.GET("/{region}/tanks/search", {
            params: { path: { region }, query: { q } },
          }),
      );
    ns.searchStream = (q, options) =>
      this.#searchStream<SearchChunk<SearchItemOf<"/{region}/tanks/search">>>(
        "tanks",
        q,
        options?.signal,
      );
    return ns;
  }

  /** Tracker coverage for this region: counts, refresh-policy health, 30-day
   * trends and infrastructure facts. */
  coverage() {
    const { api, region, baseUrl } = this;
    return handle(
      buildUrl(baseUrl, "/{region}/coverage", { region }),
      () => api.GET("/{region}/coverage", { params: { path: { region } } }),
    );
  }

  /** Server-wide live signals for this region. */
  get server(): ServerNamespace {
    const { baseUrl, region } = this;
    return {
      online: (onData, onError) =>
        subscribeSse<OnlinePayload>(
          `${baseUrl}/${region}/server/online/sse`,
          "message",
          onData,
          onError,
        ),
    };
  }
}

type StreamersNamespace = {
  /** Currently-live tracked streamers across all regions (snapshot). */
  list(): RequestHandle<Data<"/streamers/live">>;
  /** Currently-live tracked streamers across all regions, pushed over SSE.
   * Returns an unsubscribe function; browser-only. */
  live(
    onData: (streamers: LiveStreamer[]) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe;
};

type SupportNamespace = {
  /** Active supporters ranked by current monthly pledge (amount not exposed). */
  podium(): RequestHandle<Data<"/support/podium">>;
  /** Compact cumulative funding progress (percentage + raised/goal in USD). */
  funding(): RequestHandle<Data<"/support/funding">>;
};

/**
 * A fluent, typed client for the unicum.gg public API.
 *
 * ```ts
 * const unicum = new Unicum();
 * const { clan, ratings } = await unicum.eu.clans("FAME").overview();
 * const members = await unicum.eu.clans("FAME").members();
 * const spec = await unicum.eu.tanks("is-7").specifications();
 * const top = await unicum.eu.players.top({ metric: "wnx" });
 * const stop = unicum.eu.clans("FAME").live(() => refetch()); // SSE
 * ```
 */
export class Unicum {
  readonly #api: Client<paths>;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #headers: Record<string, string> | undefined;

  constructor(options: UnicumOptions = {}) {
    this.#baseUrl = options.baseUrl ?? UNICUM_API_URL;
    // Raw fetch + headers for the streamed (`searchStream`) path, which bypasses
    // openapi-fetch to read the NDJSON body incrementally.
    this.#fetch = options.fetch ?? fetch;
    this.#headers = options.headers;
    this.#api = createClient<paths>({
      baseUrl: this.#baseUrl,
      fetch: options.fetch,
      headers: options.headers,
    });
  }

  /** Scope to a region dynamically. */
  region(region: Region): RegionClient {
    return new RegionClient(
      this.#api,
      this.#baseUrl,
      this.#fetch,
      this.#headers,
      region,
    );
  }
  /** Europe. */
  get eu(): RegionClient {
    return this.region(Region.EU);
  }
  /** North America. */
  get na(): RegionClient {
    return this.region(Region.NA);
  }
  /** Asia. */
  get asia(): RegionClient {
    return this.region(Region.ASIA);
  }

  /** Global (not region-scoped) live streamers over SSE. */
  get streamers(): StreamersNamespace {
    const baseUrl = this.#baseUrl;
    return {
      list: () =>
        handle(buildUrl(baseUrl, "/streamers/live"), () =>
          this.#api.GET("/streamers/live", {}),
        ),
      live: (onData, onError) =>
        subscribeSse<LiveStreamer[]>(
          `${baseUrl}/streamers/live/sse`,
          "message",
          onData,
          onError,
        ),
    };
  }

  /** Global (not region-scoped) supporters podium. */
  get support(): SupportNamespace {
    const baseUrl = this.#baseUrl;
    return {
      podium: () =>
        handle(buildUrl(baseUrl, "/support/podium"), () =>
          this.#api.GET("/support/podium", {}),
        ),
      funding: () =>
        handle(buildUrl(baseUrl, "/support/funding"), () =>
          this.#api.GET("/support/funding", {}),
        ),
    };
  }
}

/** The success (`200`) JSON body type of a GET endpoint, for consumers that
 * want to name a response type. */
export type Data<P extends keyof paths> = Get<P> extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;
