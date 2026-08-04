import { mkdir, readFile, writeFile } from "node:fs/promises";
// Env-free subpath (region.ts imports nothing), so the generator reads the
// region enum without pulling the WG transport → env validation into codegen.
import { Region } from "@unicum.gg/wargaming/region";

/**
 * Generates the whole fluent client (`src/generated/client.ts`) from the OpenAPI
 * spec. The model is a **denylist**: every documented path is mapped to a fluent
 * method UNLESS it is excluded, and every exclusion is logged (never silent):
 *
 * - **Auto-excluded** — structurally not `await`-able JSON: SSE paths (ending
 *   `/sse`) and NDJSON streams (ending `/ndjson`). These are the hand-written
 *   `.live()`/`.online()`/`.searchStream()` specials wired from the config below.
 * - **Manually excluded** — an explicit list (currently the generic `/og` text
 *   card, consumed as a URL string, which has no region to hang a tree on).
 *
 * Everything else is generated. Method signatures come straight from the spec:
 * a query with 0 params → `m()`, exactly 1 param → a bare positional arg
 * (`search(q)`, `compare(names: string[])`), 2+ → a `query?` object (`top(q?)`).
 * Region resources (players/clans/tanks) get their configured ergonomic names;
 * the `/og/{region}/…` prefix mirrors the path into `unicum.og.eu.players("x")`.
 */

const SPEC_URL =
  process.env.UNICUM_OPENAPI_URL ?? "http://localhost:3000/api/openapi.json";
const SPEC_FILE = new URL(
  "../../../apps/web/src/services/openapi/openapi.generated.json",
  import.meta.url,
);
const OUT = new URL("../src/generated/client.ts", import.meta.url);

type Resource = {
  name: string;
  key: string;
  client: string;
  /** Fluent method for the bare `/{region}/{res}/{key}` endpoint. */
  root: string;
  /** Fluent method for the bare `/{region}/{res}` endpoint, if any. */
  namespaceRoot?: string;
  /** Runtime helper for the instance SSE `.live()` (auto-excluded `/sse` path). */
  liveHelper?: string;
  /** Emit the NDJSON `.searchStream()` (auto-excluded `/search/ndjson` path). */
  searchStream?: boolean;
};

const RESOURCES: Resource[] = [
  {
    name: "players",
    key: "nickname",
    client: "PlayerClient",
    root: "detail",
    liveHelper: "subscribePlayerLive",
    searchStream: true,
  },
  {
    name: "clans",
    key: "tag",
    client: "ClanClient",
    root: "overview",
    liveHelper: "subscribeClanLive",
    searchStream: true,
  },
  {
    name: "tanks",
    key: "slug",
    client: "TankClient",
    root: "performance",
    namespaceRoot: "list",
    searchStream: true,
  },
  {
    name: "maps",
    key: "slug",
    client: "MapClient",
    root: "detail",
    namespaceRoot: "list",
    searchStream: true,
  },
];

const GLOBALS = [{ name: "streamers", live: true }, { name: "support" }] as const;
const RENAME: Record<string, string> = { "/streamers/live": "list" };
/** Region-scoped view prefixes (before `{region}`): `/og/{region}/…`. */
const PREFIXES = ["og"] as const;
/** Explicit manual exclusions (logged): the generic `/og` (no region to nest)
 * and `/mcp` (a POST JSON-RPC protocol transport, not a data endpoint). */
const MANUAL_EXCLUDE = new Set<string>(["/og", "/mcp"]);

const byName = new Map(RESOURCES.map((r) => [r.name, r]));
const globalNames = new Set(GLOBALS.map((g) => g.name));
const prefixNames = new Set<string>(PREFIXES);

function autoExcluded(path: string): "sse" | "ndjson" | null {
  if (path.includes("/sse")) return "sse";
  if (path.endsWith("/ndjson")) return "ndjson";
  return null;
}

type QueryParam = { name: string; required: boolean };
type Endpoint = {
  path: string;
  method: "GET" | "POST";
  query: QueryParam[];
  doc: string | null;
};

type Spec = {
  paths: Record<
    string,
    Record<
      string,
      | {
          parameters?: { in: string; name: string; required?: boolean }[];
          summary?: string;
          description?: string;
        }
      | undefined
    >
  >;
};

function segmentsOf(path: string): string[] {
  return path.split("/").filter(Boolean);
}
function isParam(seg: string): boolean {
  return seg.startsWith("{") && seg.endsWith("}");
}
function camel(parts: string[]): string {
  return parts
    .join("-")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function singular(name: string): string {
  return name.replace(/s$/, "");
}

async function loadSpec(): Promise<Spec> {
  try {
    return JSON.parse(await readFile(SPEC_FILE, "utf8")) as Spec;
  } catch {
    const res = await fetch(SPEC_URL);
    if (!res.ok) {
      throw new Error(
        `No spec on disk at ${SPEC_FILE.pathname} and could not fetch ${SPEC_URL} (${res.status}).`,
      );
    }
    return (await res.json()) as Spec;
  }
}

async function loadEndpoints(): Promise<Endpoint[]> {
  const spec = await loadSpec();
  const out: Endpoint[] = [];
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const method of ["get", "post"] as const) {
      const op = ops[method];
      if (!op) continue;
      const query = (op.parameters ?? [])
        .filter((p) => p.in === "query")
        .map((p) => ({ name: p.name, required: p.required === true }));
      const doc = (op.summary ?? op.description ?? "").split("\n")[0].trim() || null;
      out.push({ path, method: method.toUpperCase() as "GET" | "POST", query, doc });
    }
  }
  return out;
}

// ── query → signature (single-param unwrap) ──────────────────────────────────

type QSig = {
  /** Typed parameter list for the method/member declaration. */
  typed: string;
  /** Untyped arrow param name(s) for a namespace assign. */
  arg: string;
  /** Extra args to `buildUrl(...)`. */
  urlArg: string;
  /** The `query: …` fragment inside the openapi-fetch `params` (leading comma). */
  callQuery: string;
};

function qsig(ep: Endpoint): QSig {
  if (ep.query.length === 0) {
    return { typed: "", arg: "", urlArg: "", callQuery: "" };
  }
  if (ep.query.length === 1) {
    const p = ep.query[0];
    const opt = p.required ? "" : "?";
    return {
      typed: `${p.name}${opt}: NonNullable<QueryOf<"${ep.path}">>["${p.name}"]`,
      arg: p.name,
      urlArg: `, { ${p.name} }`,
      callQuery: `, query: { ${p.name} }`,
    };
  }
  return {
    typed: `query?: QueryOf<"${ep.path}">`,
    arg: "query",
    urlArg: ", query",
    callQuery: ", query",
  };
}

function docComment(ep: Endpoint): string {
  return ep.doc ? `  /** ${ep.doc} */\n` : "";
}

// ── main-tree emitters ───────────────────────────────────────────────────────

function emitInstance(ep: Endpoint, r: Resource, method: string): string {
  const q = qsig(ep);
  const path = `{ region: this.region, ${r.key}: this.${r.key} }`;
  return `${docComment(ep)}  ${method}(${q.typed}) {
    const path = ${path};
    return handle(
      buildUrl(this.baseUrl, "${ep.path}", path${q.urlArg}),
      () => this.api.${ep.method}("${ep.path}", { params: { path${q.callQuery} } }),
    );
  }`;
}

function emitRoot(ep: Endpoint, method: string): string {
  const q = qsig(ep);
  const params = q.callQuery ? `{ params: {${q.callQuery.slice(1)} } }` : "{}";
  return `${docComment(ep)}  ${method}(${q.typed}) {
    return handle(
      buildUrl(this.baseUrl, "${ep.path}"${q.urlArg}),
      () => this.api.${ep.method}("${ep.path}", ${params}),
    );
  }`;
}

function emitRegion(ep: Endpoint, method: string): string {
  const q = qsig(ep);
  return `${docComment(ep)}  ${method}(${q.typed}) {
    return handle(
      buildUrl(this.baseUrl, "${ep.path}", { region: this.region }${q.urlArg}),
      () => this.api.${ep.method}("${ep.path}", { params: { path: { region: this.region }${q.callQuery} } }),
    );
  }`;
}

function emitNamespaceMember(ep: Endpoint, method: string): string {
  const q = qsig(ep);
  return `${docComment(ep)}  ${method}(${q.typed}): RequestHandle<Data<"${ep.path}">>;`;
}

function emitNamespaceAssign(ep: Endpoint, method: string, region = "this.region"): string {
  const q = qsig(ep);
  return `    ns.${method} = (${q.arg}) =>
      handle(
        buildUrl(this.baseUrl, "${ep.path}", { region: ${region} }${q.urlArg}),
        () =>
          this.api.${ep.method}("${ep.path}", {
            params: { path: { region: ${region} }${q.callQuery} },
          }),
      );`;
}

function emitGlobalMember(ep: Endpoint, method: string): string {
  const q = qsig(ep);
  return `${docComment(ep)}  ${method}(${q.typed}): RequestHandle<Data<"${ep.path}">>;`;
}

function emitGlobalAssign(ep: Endpoint, method: string): string {
  const q = qsig(ep);
  const pathArg = q.urlArg ? `, undefined${q.urlArg}` : "";
  const params = q.callQuery ? `{ params: {${q.callQuery.slice(1)} } }` : "{}";
  return `    ns.${method} = (${q.arg}) =>
      handle(buildUrl(this.baseUrl, "${ep.path}"${pathArg}), () =>
        this.api.${ep.method}("${ep.path}", ${params}),
      );`;
}

// ── classification into buckets ──────────────────────────────────────────────

type Buckets = {
  instance: Map<string, string[]>;
  nsMember: Map<string, string[]>;
  nsAssign: Map<string, string[]>;
  region: string[];
  root: string[]; // top-level Unicum methods (e.g. /health)
  og: Map<string, Endpoint[]>; // og resource name -> its endpoints
  excluded: { path: string; reason: string }[];
  unmapped: string[];
};

function bucketize(endpoints: Endpoint[]): Buckets {
  const b: Buckets = {
    instance: new Map(),
    nsMember: new Map(),
    nsAssign: new Map(),
    region: [],
    root: [],
    og: new Map(),
    excluded: [],
    unmapped: [],
  };
  const push = (m: Map<string, string[]>, k: string, v: string) =>
    m.set(k, [...(m.get(k) ?? []), v]);

  for (const ep of endpoints) {
    const auto = autoExcluded(ep.path);
    if (auto) {
      b.excluded.push({ path: ep.path, reason: `auto:${auto}` });
      continue;
    }
    if (MANUAL_EXCLUDE.has(ep.path)) {
      b.excluded.push({ path: ep.path, reason: "manual" });
      continue;
    }

    const segs = segmentsOf(ep.path);
    const rename = RENAME[ep.path];

    // Global namespace (streamers/support).
    if (globalNames.has(segs[0])) {
      const method = rename ?? camel(segs.slice(1));
      push(b.nsMember, segs[0], emitGlobalMember(ep, method));
      push(b.nsAssign, segs[0], emitGlobalAssign(ep, method));
      continue;
    }

    // Region-scoped view prefix (`/og/{region}/…`) → the og tree.
    if (prefixNames.has(segs[0]) && isParam(segs[1])) {
      const res = segs[2];
      if (res) (b.og.get(res) ?? b.og.set(res, []).get(res)!).push(ep);
      continue;
    }

    if (!isParam(segs[0])) {
      // Top-level GET (e.g. /health) → a Unicum method; anything else is loud.
      if (segs.length === 1 && ep.method === "GET") {
        b.root.push(emitRoot(ep, rename ?? camel(segs)));
      } else {
        b.unmapped.push(ep.path);
      }
      continue;
    }

    const rest = segs.slice(1);
    const resource = byName.get(rest[0]);
    if (!resource) {
      if (rest.length === 1) b.region.push(emitRegion(ep, rename ?? camel(rest)));
      else b.unmapped.push(ep.path);
      continue;
    }

    const afterRes = rest.slice(1);
    if (afterRes.length === 0) {
      if (resource.namespaceRoot) {
        const m = rename ?? resource.namespaceRoot;
        push(b.nsMember, resource.name, emitNamespaceMember(ep, m));
        push(b.nsAssign, resource.name, emitNamespaceAssign(ep, m));
      } else {
        b.unmapped.push(ep.path);
      }
    } else if (isParam(afterRes[0])) {
      const sub = afterRes.slice(1);
      const m = sub.length === 0 ? resource.root : rename ?? camel(sub);
      push(b.instance, resource.name, emitInstance(ep, resource, m));
    } else {
      const m = rename ?? camel(afterRes);
      push(b.nsMember, resource.name, emitNamespaceMember(ep, m));
      push(b.nsAssign, resource.name, emitNamespaceAssign(ep, m));
    }
  }
  return b;
}

// ── special (non-spec) method emitters ───────────────────────────────────────

function instanceLive(r: Resource): string {
  if (!r.liveHelper) return "";
  return `

  /** Subscribe to live updates for this ${singular(r.name)} (SSE). Browser-only. */
  live(onUpdate: (event: LiveUpdate) => void, onError?: (error: Event) => void): Unsubscribe {
    return ${r.liveHelper}(this.baseUrl, this.region, this.${r.key}, onUpdate, onError);
  }`;
}

function searchStreamMember(r: Resource): string {
  if (!r.searchStream) return "";
  const item = `/{region}/${r.name}/search`;
  return `  /** Streamed ${singular(r.name)} search: NDJSON chunks (local DB first, then Wargaming). */
  searchStream(
    q: string,
    options?: SearchStreamOptions,
  ): AsyncGenerator<SearchChunk<SearchItemOf<"${item}">>>;`;
}

function searchStreamAssign(r: Resource): string {
  if (!r.searchStream) return "";
  const item = `/{region}/${r.name}/search`;
  return `    ns.searchStream = (q, options) =>
      ndjsonSearch<SearchItemOf<"${item}">>(
        this.baseUrl,
        this.region,
        this.fetchImpl,
        this.headers,
        "${r.name}",
        q,
        options?.signal,
      );`;
}

// ── og prefix tree ───────────────────────────────────────────────────────────

type OgResource = {
  name: string;
  key: string;
  rootPath: string; // /og/{region}/{res}/{key}
  methods: { ep: Endpoint; name: string }[]; // namespace methods (compare, …)
};

function ogResources(b: Buckets): OgResource[] {
  const out: OgResource[] = [];
  for (const [name, eps] of b.og) {
    let rootPath = "";
    let key = "";
    const methods: { ep: Endpoint; name: string }[] = [];
    for (const ep of eps) {
      const afterRes = segmentsOf(ep.path).slice(3); // after og/{region}/{res}
      if (afterRes.length === 1 && isParam(afterRes[0])) {
        rootPath = ep.path;
        key = afterRes[0].slice(1, -1);
      } else {
        methods.push({ ep, name: camel(afterRes) });
      }
    }
    if (rootPath) out.push({ name, key, rootPath, methods });
  }
  return out.sort((a, z) => a.name.localeCompare(z.name));
}

function ogNamespaceType(r: OgResource): string {
  const members = r.methods.map(({ ep, name }) => {
    const q = qsig(ep);
    return `  ${name}(${q.typed}): RequestHandle<unknown>;`;
  });
  const callable = `(${r.key}: string) => RequestHandle<unknown>`;
  return members.length
    ? `type Og${cap(r.name)} = (${callable}) & {\n${members.join("\n")}\n};`
    : `type Og${cap(r.name)} = ${callable};`;
}

function ogNamespaceGetter(r: OgResource): string {
  const root = `(${r.key}: string) =>
      handle(
        buildUrl(this.baseUrl, "${r.rootPath}", { region: this.region, ${r.key} }),
        () =>
          this.api.GET("${r.rootPath}", {
            params: { path: { region: this.region, ${r.key} } },
          }),
      )`;
  if (!r.methods.length) {
    return `  get ${r.name}(): Og${cap(r.name)} {
    return ${root};
  }`;
  }
  const assigns = r.methods
    .map(({ ep, name }) => emitNamespaceAssign(ep, name))
    .join("\n");
  return `  get ${r.name}(): Og${cap(r.name)} {
    const ns = (${root}) as Og${cap(r.name)};
${assigns}
    return ns;
  }`;
}

// ── render ───────────────────────────────────────────────────────────────────

const get = (m: Map<string, string[]>, k: string, sep = "\n\n") => (m.get(k) ?? []).join(sep);
const nonEmpty = (...p: string[]) => p.filter(Boolean);

function renderInstanceClass(r: Resource, b: Buckets): string {
  return `/** A single ${singular(r.name)}: unicum.eu.${r.name}("..."). */
class ${r.client} {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
    private readonly region: Region,
    private readonly ${r.key}: string,
  ) {}

${get(b.instance, r.name)}${instanceLive(r)}
}`;
}

function renderNamespaceType(r: Resource, b: Buckets): string {
  const members = nonEmpty(get(b.nsMember, r.name, "\n"), searchStreamMember(r)).join("\n");
  return `type ${cap(r.name)}Namespace = ((${r.key}: string) => ${r.client}) & {
${members}
};`;
}

function renderNamespaceGetter(r: Resource, b: Buckets): string {
  const assigns = nonEmpty(get(b.nsAssign, r.name, "\n"), searchStreamAssign(r)).join("\n");
  return `  get ${r.name}(): ${cap(r.name)}Namespace {
    const ns = ((${r.key}: string) =>
      new ${r.client}(this.api, this.baseUrl, this.region, ${r.key})) as ${cap(r.name)}Namespace;
${assigns}
    return ns;
  }`;
}

function renderGlobalType(g: (typeof GLOBALS)[number], b: Buckets): string {
  const live =
    "live" in g && g.live
      ? `  /** Currently-live tracked streamers across all regions, over SSE. Browser-only. */
  live(
    onData: (streamers: LiveStreamer[]) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe;`
      : "";
  const members = nonEmpty(get(b.nsMember, g.name, "\n"), live).join("\n");
  return `type ${cap(g.name)}Namespace = {\n${members}\n};`;
}

function renderGlobalGetter(g: (typeof GLOBALS)[number], b: Buckets): string {
  const live =
    "live" in g && g.live
      ? `    ns.live = (onData, onError) =>
      subscribeStreamersLive(this.baseUrl, onData, onError);`
      : "";
  const assigns = nonEmpty(get(b.nsAssign, g.name, "\n"), live).join("\n");
  return `  /** Global (not region-scoped) ${g.name}. */
  get ${g.name}(): ${cap(g.name)}Namespace {
    const ns = {} as ${cap(g.name)}Namespace;
${assigns}
    return ns;
  }`;
}

function renderRegionGetters(): string {
  return Object.entries(Region)
    .map(
      ([k, v]) => `  /** The ${String(v).toUpperCase()} region. */
  get ${v}(): RegionClient {
    return this.region(Region.${k});
  }`,
    )
    .join("\n");
}

function render(b: Buckets): string {
  const ogRes = ogResources(b);
  const hasOg = ogRes.length > 0;

  const instanceClasses = RESOURCES.map((r) => renderInstanceClass(r, b)).join("\n\n");
  const namespaceTypes = RESOURCES.map((r) => renderNamespaceType(r, b)).join("\n\n");
  const namespaceGetters = RESOURCES.map((r) => renderNamespaceGetter(r, b)).join("\n\n");
  const globalTypes = GLOBALS.map((g) => renderGlobalType(g, b)).join("\n\n");
  const globalGetters = GLOBALS.map((g) => renderGlobalGetter(g, b)).join("\n\n");

  const ogBlock = hasOg
    ? `
${ogRes.map(ogNamespaceType).join("\n\n")}

/** The \`/og/{region}/…\` image cards, mirroring the entity paths: their \`.url()\`
 * is the stable PNG URL (used for og:image / embeds; not meant to be awaited). */
class OgRegionClient {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
    private readonly region: Region,
  ) {}

${ogRes.map(ogNamespaceGetter).join("\n\n")}
}

class OgClient {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
  ) {}

  region(region: Region): OgRegionClient {
    return new OgRegionClient(this.api, this.baseUrl, region);
  }
${Object.entries(Region)
  .map(([k, v]) => `  get ${v}(): OgRegionClient {\n    return this.region(Region.${k});\n  }`)
  .join("\n")}
}
`
    : "";

  const ogGetter = hasOg
    ? `
  /** OG image cards: unicum.og.eu.players("Rice").url() → /og/eu/players/Rice. */
  get og(): OgClient {
    return new OgClient(this.api, this.baseUrl);
  }
`
    : "";

  return `// AUTO-GENERATED by scripts/generate-client.ts — do not edit.
// Run "pnpm --filter @unicum.gg/sdk generate" to refresh from the OpenAPI spec.
import { Region } from "@unicum.gg/wargaming";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import {
  type ApiClient,
  type Data,
  type LiveStreamer,
  type LiveUpdate,
  ndjsonSearch,
  type QueryOf,
  type RequestHandle,
  type SearchChunk,
  type SearchItemOf,
  type SearchStreamOptions,
  subscribeClanLive,
  subscribePlayerLive,
  subscribeServerOnline,
  subscribeStreamersLive,
  type Unsubscribe,
  type OnlinePayload,
  type UnicumOptions,
  UNICUM_API_URL,
  buildUrl,
  handle,
} from "../runtime";

${instanceClasses}

${namespaceTypes}

type ServerNamespace = {
  /** Live count of players online for this region (SSE). Browser-only. */
  online(
    onData: (payload: OnlinePayload) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe;
};

/** Every resource scoped to one region: unicum.eu, unicum.region("na"). */
class RegionClient {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch,
    private readonly headers: Record<string, string> | undefined,
    readonly region: Region,
  ) {}

${namespaceGetters}

${b.region.join("\n\n")}

  /** Server-wide live signals for this region. */
  get server(): ServerNamespace {
    return {
      online: (onData, onError) =>
        subscribeServerOnline(this.baseUrl, this.region, onData, onError),
    };
  }
}
${ogBlock}
${globalTypes}

/**
 * A fluent, typed client for the unicum.gg public API.
 *
 *   const unicum = new Unicum();
 *   const { clan, ratings } = await unicum.eu.clans("FAME").overview();
 *   const top = await unicum.eu.players.top({ metric: "wnx" });
 *   const stop = unicum.eu.clans("FAME").live(() => refetch()); // SSE
 */
export class Unicum {
  private readonly api: ApiClient;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string> | undefined;

  constructor(options: UnicumOptions = {}) {
    this.baseUrl = options.baseUrl ?? UNICUM_API_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.headers = options.headers;
    this.api = createClient<paths>({
      baseUrl: this.baseUrl,
      fetch: options.fetch,
      headers: options.headers,
      // Array query params serialize as CSV (?names=a,b), matching the routes.
      querySerializer: { array: { style: "form", explode: false } },
    });
  }

  /** Scope to a region dynamically. */
  region(region: Region): RegionClient {
    return new RegionClient(this.api, this.baseUrl, this.fetchImpl, this.headers, region);
  }
${renderRegionGetters()}

${b.root.join("\n\n")}
${ogGetter}
${globalGetters}
}
`;
}

async function main() {
  const endpoints = await loadEndpoints();
  const b = bucketize(endpoints);

  await mkdir(new URL(".", OUT), { recursive: true });
  await writeFile(OUT, render(b));

  const generated =
    endpoints.length - b.excluded.length - b.unmapped.length;
  console.log(`Generated ${generated}/${endpoints.length} documented endpoints into generated/client.ts`);
  for (const e of b.excluded) console.log(`  excluded (${e.reason}): ${e.path}`);
  if (b.unmapped.length) {
    console.warn(`  ⚠ UNMAPPED (no rule, not generated): ${b.unmapped.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
