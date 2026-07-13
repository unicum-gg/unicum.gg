import { APP_IDENTITY } from "@unicum.gg/core";
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema";

/** The three World of Tanks regions the API is scoped to. */
export type Region = "eu" | "na" | "asia";

/**
 * Default API base URL: this instance's own origin plus `/api`, so the client
 * follows the environment it runs in (dev server locally, `unicum.gg` in prod)
 * instead of hardcoding a domain. Sourced from `APP_IDENTITY.URL`
 * (`NEXT_PUBLIC_APP_URL`), the single source of truth in core. Override per
 * client via `new Unicum({ baseUrl })`.
 */
export const UNICUM_API_URL = `${APP_IDENTITY.URL}/api`;

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
    super(`unicum.gg API request to ${url} failed with ${status}`);
    this.name = "UnicumError";
  }
}

type Get<P extends keyof paths> = paths[P] extends { get: infer G } ? G : never;
type QueryOf<P extends keyof paths> = Get<P> extends {
  parameters: { query?: infer Q };
}
  ? Q
  : undefined;

async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok || error !== undefined) {
    throw new UnicumError(response.status, response.url, error ?? data);
  }
  return data as T;
}

/** A single player: `unicum.eu.players("Rice")`. */
class PlayerClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly region: Region,
    private readonly nickname: string,
  ) {}

  /** Full player detail (profile, overall stats, periods, derived, vehicles,
   * rating history, clan history, strongholds). */
  detail() {
    return unwrap(
      this.api.GET("/{region}/players/{nickname}", {
        params: { path: { region: this.region, nickname: this.nickname } },
      }),
    );
  }
}

type PlayersNamespace = ((nickname: string) => PlayerClient) & {
  /** Combined (non-streamed) player search by nickname prefix. */
  search(q: string): Promise<Data<"/{region}/players/search">>;
  /** Player leaderboard for the region. */
  top(
    query?: QueryOf<"/{region}/players/top">,
  ): Promise<Data<"/{region}/players/top">>;
};

/** A single clan: `unicum.eu.clans("FAME")`. */
class ClanClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly region: Region,
    private readonly tag: string,
  ) {}

  /** Clan overview: profile + aggregate ratings. */
  overview() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}", { params: { path: { region, tag } } }),
    );
  }
  /** Members with cached WN7/WN8/WNX ratings. */
  members() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/members", {
        params: { path: { region, tag } },
      }),
    );
  }
  /** Clans the members previously belonged to. */
  previousClans() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/previous-clans", {
        params: { path: { region, tag } },
      }),
    );
  }
  /** Recent join / leave / role-change events. */
  activity() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/activity", {
        params: { path: { region, tag } },
      }),
    );
  }
  /** Stronghold Elo + skirmish/advances (latest + period diffs). */
  stronghold() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/stronghold", {
        params: { path: { region, tag } },
      }),
    );
  }
  /** Global Map (Clan Wars) stats (latest + period diffs). */
  clanWars() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/clan-wars", {
        params: { path: { region, tag } },
      }),
    );
  }
  /** Per-tank aggregates across all members. */
  vehicles() {
    const { region, tag } = this;
    return unwrap(
      this.api.GET("/{region}/clans/{tag}/vehicles", {
        params: { path: { region, tag } },
      }),
    );
  }
}

type ClansNamespace = ((tag: string) => ClanClient) & {
  search(q: string): Promise<Data<"/{region}/clans/search">>;
  top(query?: QueryOf<"/{region}/clans/top">): Promise<Data<"/{region}/clans/top">>;
};

/** A single tank: `unicum.eu.tanks("is-7")`. */
class TankClient {
  constructor(
    private readonly api: Client<paths>,
    private readonly region: Region,
    private readonly slug: string,
  ) {}

  /** Server-wide performance for this tank. */
  performance() {
    const { region, slug } = this;
    return unwrap(
      this.api.GET("/{region}/tanks/{slug}", { params: { path: { region, slug } } }),
    );
  }
  /** Combat specifications. */
  specifications() {
    const { region, slug } = this;
    return unwrap(
      this.api.GET("/{region}/tanks/{slug}/specifications", {
        params: { path: { region, slug } },
      }),
    );
  }
  /** Economics (price, ammo cost, research XP). */
  economics() {
    const { region, slug } = this;
    return unwrap(
      this.api.GET("/{region}/tanks/{slug}/economics", {
        params: { path: { region, slug } },
      }),
    );
  }
  /** Marks of Excellence thresholds. */
  marksOfExcellence() {
    const { region, slug } = this;
    return unwrap(
      this.api.GET("/{region}/tanks/{slug}/marks-of-excellence", {
        params: { path: { region, slug } },
      }),
    );
  }
  /** Marks of Mastery XP thresholds. */
  marksOfMastery() {
    const { region, slug } = this;
    return unwrap(
      this.api.GET("/{region}/tanks/{slug}/marks-of-mastery", {
        params: { path: { region, slug } },
      }),
    );
  }
}

type TanksNamespace = ((slug: string) => TankClient) & {
  /** Per-tank server performance for the whole region catalogue. */
  list(): Promise<Data<"/{region}/tanks">>;
  /** Combat specifications for the whole region catalogue. */
  specifications(): Promise<Data<"/{region}/tanks/specifications">>;
  /** Economics for the whole region catalogue. */
  economics(): Promise<Data<"/{region}/tanks/economics">>;
  /** Marks of Excellence thresholds for the whole region catalogue. */
  marksOfExcellence(): Promise<Data<"/{region}/tanks/marks-of-excellence">>;
  /** Marks of Mastery thresholds for the whole region catalogue. */
  marksOfMastery(): Promise<Data<"/{region}/tanks/marks-of-mastery">>;
  /** Vehicle catalogue search by name / short name / tag. */
  search(q: string): Promise<Data<"/{region}/tanks/search">>;
};

/** Every resource scoped to one region: `unicum.eu`, `unicum.region("na")`. */
class RegionClient {
  constructor(
    private readonly api: Client<paths>,
    readonly region: Region,
  ) {}

  get players(): PlayersNamespace {
    const { api, region } = this;
    const ns = ((nickname: string) =>
      new PlayerClient(api, region, nickname)) as PlayersNamespace;
    ns.search = (q) =>
      unwrap(
        api.GET("/{region}/players/search", {
          params: { path: { region }, query: { q } },
        }),
      );
    ns.top = (query) =>
      unwrap(
        api.GET("/{region}/players/top", { params: { path: { region }, query } }),
      );
    return ns;
  }

  get clans(): ClansNamespace {
    const { api, region } = this;
    const ns = ((tag: string) =>
      new ClanClient(api, region, tag)) as ClansNamespace;
    ns.search = (q) =>
      unwrap(
        api.GET("/{region}/clans/search", {
          params: { path: { region }, query: { q } },
        }),
      );
    ns.top = (query) =>
      unwrap(
        api.GET("/{region}/clans/top", { params: { path: { region }, query } }),
      );
    return ns;
  }

  get tanks(): TanksNamespace {
    const { api, region } = this;
    const ns = ((slug: string) =>
      new TankClient(api, region, slug)) as TanksNamespace;
    const p = { params: { path: { region } } } as const;
    ns.list = () => unwrap(api.GET("/{region}/tanks", p));
    ns.specifications = () =>
      unwrap(api.GET("/{region}/tanks/specifications", p));
    ns.economics = () => unwrap(api.GET("/{region}/tanks/economics", p));
    ns.marksOfExcellence = () =>
      unwrap(api.GET("/{region}/tanks/marks-of-excellence", p));
    ns.marksOfMastery = () =>
      unwrap(api.GET("/{region}/tanks/marks-of-mastery", p));
    ns.search = (q) =>
      unwrap(
        api.GET("/{region}/tanks/search", {
          params: { path: { region }, query: { q } },
        }),
      );
    return ns;
  }
}

/**
 * A fluent, typed client for the unicum.gg public API.
 *
 * ```ts
 * const unicum = new Unicum();
 * const { clan, ratings } = await unicum.eu.clans("FAME").overview();
 * const members = await unicum.eu.clans("FAME").members();
 * const spec = await unicum.eu.tanks("is-7").specifications();
 * const top = await unicum.eu.players.top({ metric: "wnx" });
 * ```
 */
export class Unicum {
  readonly #api: Client<paths>;

  constructor(options: UnicumOptions = {}) {
    this.#api = createClient<paths>({
      baseUrl: options.baseUrl ?? UNICUM_API_URL,
      fetch: options.fetch,
      headers: options.headers,
    });
  }

  /** Scope to a region dynamically. */
  region(region: Region): RegionClient {
    return new RegionClient(this.#api, region);
  }
  /** Europe. */
  get eu(): RegionClient {
    return this.region("eu");
  }
  /** North America. */
  get na(): RegionClient {
    return this.region("na");
  }
  /** Asia. */
  get asia(): RegionClient {
    return this.region("asia");
  }
}

/** The success (`200`) JSON body type of a GET endpoint, for consumers that
 * want to name a response type. */
export type Data<P extends keyof paths> = Get<P> extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;
