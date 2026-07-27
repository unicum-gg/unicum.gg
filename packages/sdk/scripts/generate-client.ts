import { mkdir, readFile, writeFile } from "node:fs/promises";
// Env-free subpath (region.ts imports nothing), so the generator reads the
// region enum without pulling the WG transport → env validation into codegen.
import { Region } from "@unicum.gg/wargaming/region";

/**
 * Generates the whole fluent client (`src/generated/client.ts`) from the served
 * OpenAPI spec. The file is 100% machine output and nothing is hand-typed per
 * resource: a `RESOURCES` / `GLOBALS` config drives the emission, and the render
 * loops over it to produce every instance class, namespace, and the `Unicum`
 * shell. Adding a resource is one config entry, not a new hand-written class.
 *
 * Two kinds of methods:
 * - **Plain REST** come from the spec by path convention:
 *     /{region}/{res}/{key}          -> region(r).{res}(key).<root>()
 *     /{region}/{res}/{key}/{sub..}  -> region(r).{res}(key).{camel sub}()
 *     /{region}/{res}/{action..}     -> region(r).{res}.{camel action}()
 *     /{region}/{res}                -> region(r).{res}.<namespaceRoot>()
 *     /{region}/{action}             -> region(r).{camel action}()
 *     /{global}/{action..}           -> unicum.{global}.{camel action}()
 * - **Specials** the spec can't describe (SSE `.live`/`.online`, NDJSON
 *   `.searchStream`, bare-string `.search`, array→CSV `.compare`) are declared as
 *   flags on the config and emitted as thin delegations to the `runtime.ts`
 *   helpers, so the generated file stays backtick-free pure structure.
 */

const SPEC_URL =
  process.env.UNICUM_OPENAPI_URL ?? "http://localhost:3000/api/openapi.json";
// The spec paths are also written to disk on predev/prebuild, so the client can
// regenerate without the dev server up (only the schema generator needs it live).
const SPEC_FILE = new URL(
  "../../../apps/web/src/services/openapi/openapi.generated.json",
  import.meta.url,
);
const OUT = new URL("../src/generated/client.ts", import.meta.url);

/** A region sub-resource keyed by one entity (players/clans/tanks). */
type Resource = {
  /** URL segment + namespace getter name (`players`). */
  name: string;
  /** Entity key path param (nickname/tag/slug). */
  key: string;
  /** Generated instance-client class name. */
  client: string;
  /** Method for the bare `/{region}/{res}/{key}` endpoint. */
  root: string;
  /** Method for the bare `/{region}/{res}` endpoint, if the resource has one. */
  namespaceRoot?: string;
  /** Runtime helper for the instance `.live()` SSE, if the resource has one. */
  liveHelper?: string;
  /** Emit namespace `.search()` + `.searchStream()`. */
  search?: boolean;
  /** Param name for namespace `.compare()` (array→CSV), if the resource has one. */
  compareParam?: string;
};

const RESOURCES: Resource[] = [
  {
    name: "players",
    key: "nickname",
    client: "PlayerClient",
    root: "detail",
    liveHelper: "subscribePlayerLive",
    search: true,
    compareParam: "names",
  },
  {
    name: "clans",
    key: "tag",
    client: "ClanClient",
    root: "overview",
    liveHelper: "subscribeClanLive",
    search: true,
    compareParam: "tags",
  },
  {
    name: "tanks",
    key: "slug",
    client: "TankClient",
    root: "performance",
    namespaceRoot: "list",
    search: true,
  },
];

/** A non-region top-level namespace (`unicum.streamers`, `unicum.support`). */
type Global = { name: string; live?: boolean };
const GLOBALS: Global[] = [{ name: "streamers", live: true }, { name: "support" }];

/** Full spec path → method name, when the camel-of-last-segments rule is wrong. */
const RENAME: Record<string, string> = { "/streamers/live": "list" };

const byName = new Map(RESOURCES.map((r) => [r.name, r]));
const globalNames = new Set(GLOBALS.map((g) => g.name));

// Endpoints served by a special (hand-written delegation) instead of a generated
// method: every SSE / NDJSON / search / compare route.
function isManual(path: string): boolean {
  return (
    path.includes("/sse") ||
    path.endsWith("/ndjson") ||
    path.endsWith("/search") ||
    path.endsWith("/compare")
  );
}

type Endpoint = {
  path: string;
  method: "GET" | "POST";
  hasQuery: boolean;
  doc: string | null;
};

type Spec = {
  paths: Record<
    string,
    Record<
      string,
      { parameters?: { in: string }[]; summary?: string; description?: string } | undefined
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

/** Load the spec from disk (regenerated on predev/prebuild) if present, else
 * fall back to the served endpoint. Reading the file means the client can
 * regenerate even while the barrel points at a not-yet-generated client. */
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
      const hasQuery = (op.parameters ?? []).some((p) => p.in === "query");
      const doc = (op.summary ?? op.description ?? "").split("\n")[0].trim() || null;
      out.push({ path, method: method.toUpperCase() as "GET" | "POST", hasQuery, doc });
    }
  }
  return out;
}

type Target =
  | { kind: "instance"; resource: Resource; method: string; ep: Endpoint }
  | { kind: "namespace"; resource: Resource; method: string; ep: Endpoint }
  | { kind: "region"; method: string; ep: Endpoint }
  | { kind: "global"; ns: string; method: string; ep: Endpoint };

function classify(ep: Endpoint): Target | null {
  if (isManual(ep.path)) return null;
  const segs = segmentsOf(ep.path);
  const rename = RENAME[ep.path];

  if (globalNames.has(segs[0])) {
    return { kind: "global", ns: segs[0], method: rename ?? camel(segs.slice(1)), ep };
  }

  if (!isParam(segs[0])) return null; // not a {region} path we model
  const rest = segs.slice(1);
  const resource = byName.get(rest[0]);

  if (!resource) {
    return rest.length === 1
      ? { kind: "region", method: rename ?? camel(rest), ep }
      : null;
  }

  const afterRes = rest.slice(1);
  if (afterRes.length === 0) {
    if (!resource.namespaceRoot) return null;
    return { kind: "namespace", resource, method: rename ?? resource.namespaceRoot, ep };
  }
  if (isParam(afterRes[0])) {
    const sub = afterRes.slice(1);
    const method = sub.length === 0 ? resource.root : rename ?? camel(sub);
    return { kind: "instance", resource, method, ep };
  }
  return { kind: "namespace", resource, method: rename ?? camel(afterRes), ep };
}

function docComment(ep: Endpoint): string {
  return ep.doc ? `  /** ${ep.doc} */\n` : "";
}

function emitInstance(t: Extract<Target, { kind: "instance" }>): string {
  const { ep, method, resource } = t;
  const path = `{ region: this.region, ${resource.key}: this.${resource.key} }`;
  if (ep.hasQuery) {
    return `${docComment(ep)}  ${method}(query?: QueryOf<"${ep.path}">) {
    const path = ${path};
    return handle(
      buildUrl(this.baseUrl, "${ep.path}", path, query),
      () => this.api.${ep.method}("${ep.path}", { params: { path, query } }),
    );
  }`;
  }
  return `${docComment(ep)}  ${method}() {
    const path = ${path};
    return handle(
      buildUrl(this.baseUrl, "${ep.path}", path),
      () => this.api.${ep.method}("${ep.path}", { params: { path } }),
    );
  }`;
}

function emitRegion(t: Extract<Target, { kind: "region" }>): string {
  const { ep, method } = t;
  const q = ep.hasQuery;
  const sig = q ? `query?: QueryOf<"${ep.path}">` : "";
  const urlArgs = q ? ", query" : "";
  const params = q
    ? "{ path: { region: this.region }, query }"
    : "{ path: { region: this.region } }";
  return `${docComment(ep)}  ${method}(${sig}) {
    return handle(
      buildUrl(this.baseUrl, "${ep.path}", { region: this.region }${urlArgs}),
      () => this.api.${ep.method}("${ep.path}", { params: ${params} }),
    );
  }`;
}

function emitNamespaceMember(t: Extract<Target, { kind: "namespace" | "global" }>): string {
  const { ep, method } = t;
  const arg = ep.hasQuery ? `query?: QueryOf<"${ep.path}">` : "";
  return `${docComment(ep)}  ${method}(${arg}): RequestHandle<Data<"${ep.path}">>;`;
}

function emitNamespaceAssign(t: Extract<Target, { kind: "namespace" }>): string {
  const { ep, method } = t;
  if (ep.hasQuery) {
    return `    ns.${method} = (query) =>
      handle(
        buildUrl(this.baseUrl, "${ep.path}", { region: this.region }, query),
        () =>
          this.api.${ep.method}("${ep.path}", {
            params: { path: { region: this.region }, query },
          }),
      );`;
  }
  return `    ns.${method} = () =>
      handle(
        buildUrl(this.baseUrl, "${ep.path}", { region: this.region }),
        () =>
          this.api.${ep.method}("${ep.path}", { params: { path: { region: this.region } } }),
      );`;
}

function emitGlobalAssign(t: Extract<Target, { kind: "global" }>): string {
  const { ep, method } = t;
  if (ep.hasQuery) {
    return `    ns.${method} = (query) =>
      handle(buildUrl(this.baseUrl, "${ep.path}", undefined, query), () =>
        this.api.${ep.method}("${ep.path}", { params: { query } }),
      );`;
  }
  return `    ns.${method} = () =>
      handle(buildUrl(this.baseUrl, "${ep.path}"), () =>
        this.api.${ep.method}("${ep.path}", {}),
      );`;
}

// Buckets of generated code, keyed by resource/namespace, filled from the spec.
type Buckets = {
  instance: Map<string, string[]>; // resource.name -> instance method blocks
  nsMember: Map<string, string[]>; // resource/global name -> namespace type members
  nsAssign: Map<string, string[]>; // resource/global name -> namespace assigns
  region: string[]; // region-level method blocks (coverage, ...)
};

function bucketize(targets: Target[]): Buckets {
  const b: Buckets = {
    instance: new Map(),
    nsMember: new Map(),
    nsAssign: new Map(),
    region: [],
  };
  const push = (m: Map<string, string[]>, k: string, v: string) =>
    m.set(k, [...(m.get(k) ?? []), v]);
  for (const t of targets) {
    if (t.kind === "instance") {
      push(b.instance, t.resource.name, emitInstance(t));
    } else if (t.kind === "region") {
      b.region.push(emitRegion(t));
    } else if (t.kind === "namespace") {
      push(b.nsMember, t.resource.name, emitNamespaceMember(t));
      push(b.nsAssign, t.resource.name, emitNamespaceAssign(t));
    } else {
      push(b.nsMember, t.ns, emitNamespaceMember(t));
      push(b.nsAssign, t.ns, emitGlobalAssign(t));
    }
  }
  return b;
}

// ── special (non-spec) method emitters, parametrized by resource ──────────────

function instanceLive(r: Resource): string {
  if (!r.liveHelper) return "";
  return `

  /** Subscribe to live updates for this ${singular(r.name)} (SSE). Browser-only. */
  live(onUpdate: (event: LiveUpdate) => void, onError?: (error: Event) => void): Unsubscribe {
    return ${r.liveHelper}(this.baseUrl, this.region, this.${r.key}, onUpdate, onError);
  }`;
}

function searchMembers(r: Resource): string {
  if (!r.search) return "";
  const item = `/{region}/${r.name}/search`;
  return `  /** Combined (non-streamed) ${singular(r.name)} search. */
  search(q: string): RequestHandle<Data<"${item}">>;
  /** Streamed ${singular(r.name)} search: NDJSON chunks (local DB first, then Wargaming). */
  searchStream(
    q: string,
    options?: SearchStreamOptions,
  ): AsyncGenerator<SearchChunk<SearchItemOf<"${item}">>>;`;
}

function searchAssigns(r: Resource): string {
  if (!r.search) return "";
  const item = `/{region}/${r.name}/search`;
  return `    ns.search = (q) =>
      handle(
        buildUrl(this.baseUrl, "${item}", { region: this.region }, { q }),
        () =>
          this.api.GET("${item}", {
            params: { path: { region: this.region }, query: { q } },
          }),
      );
    ns.searchStream = (q, options) =>
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

function compareMember(r: Resource): string {
  if (!r.compareParam) return "";
  const p = r.compareParam;
  return `  /** Side-by-side comparison inputs for up to 4 ${r.name}. */
  compare(${p}: string[]): RequestHandle<Data<"/{region}/${r.name}/compare">>;`;
}

function compareAssign(r: Resource): string {
  if (!r.compareParam) return "";
  const p = r.compareParam;
  return `    ns.compare = (${p}) =>
      handle(
        buildUrl(this.baseUrl, "/{region}/${r.name}/compare", { region: this.region }, {
          ${p}: ${p}.join(","),
        }),
        () =>
          this.api.GET("/{region}/${r.name}/compare", {
            params: { path: { region: this.region }, query: { ${p}: ${p}.join(",") } },
          }),
      );`;
}

// ── render (loops over the config) ───────────────────────────────────────────

const nonEmpty = (...parts: string[]) => parts.filter(Boolean);

function renderInstanceClass(r: Resource, b: Buckets): string {
  const methods = (b.instance.get(r.name) ?? []).join("\n\n");
  return `/** A single ${singular(r.name)}: unicum.eu.${r.name}("..."). */
class ${r.client} {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
    private readonly region: Region,
    private readonly ${r.key}: string,
  ) {}

${methods}${instanceLive(r)}
}`;
}

function renderNamespaceType(r: Resource, b: Buckets): string {
  const members = nonEmpty(
    (b.nsMember.get(r.name) ?? []).join("\n"),
    searchMembers(r),
    compareMember(r),
  ).join("\n");
  return `type ${cap(r.name)}Namespace = ((${r.key}: string) => ${r.client}) & {
${members}
};`;
}

function renderNamespaceGetter(r: Resource, b: Buckets): string {
  const assigns = nonEmpty(
    (b.nsAssign.get(r.name) ?? []).join("\n"),
    searchAssigns(r),
    compareAssign(r),
  ).join("\n");
  return `  get ${r.name}(): ${cap(r.name)}Namespace {
    const ns = ((${r.key}: string) =>
      new ${r.client}(this.api, this.baseUrl, this.region, ${r.key})) as ${cap(r.name)}Namespace;
${assigns}
    return ns;
  }`;
}

function renderGlobalType(g: Global, b: Buckets): string {
  const live = g.live
    ? `  /** Currently-live tracked streamers across all regions, over SSE. Browser-only. */
  live(
    onData: (streamers: LiveStreamer[]) => void,
    onError?: (error: Event) => void,
  ): Unsubscribe;`
    : "";
  const members = nonEmpty((b.nsMember.get(g.name) ?? []).join("\n"), live).join("\n");
  return `type ${cap(g.name)}Namespace = {
${members}
};`;
}

function renderGlobalGetter(g: Global, b: Buckets): string {
  const live = g.live
    ? `    ns.live = (onData, onError) =>
      subscribeStreamersLive(this.baseUrl, onData, onError);`
    : "";
  const assigns = nonEmpty((b.nsAssign.get(g.name) ?? []).join("\n"), live).join("\n");
  return `  /** Global (not region-scoped) ${g.name}. */
  get ${g.name}(): ${cap(g.name)}Namespace {
    const ns = {} as ${cap(g.name)}Namespace;
${assigns}
    return ns;
  }`;
}

function render(b: Buckets): string {
  const instanceClasses = RESOURCES.map((r) => renderInstanceClass(r, b)).join("\n\n");
  const namespaceTypes = RESOURCES.map((r) => renderNamespaceType(r, b)).join("\n\n");
  const namespaceGetters = RESOURCES.map((r) => renderNamespaceGetter(r, b)).join("\n\n");
  const globalTypes = GLOBALS.map((g) => renderGlobalType(g, b)).join("\n\n");
  const globalGetters = GLOBALS.map((g) => renderGlobalGetter(g, b)).join("\n\n");
  const regionMethods = b.region.join("\n\n");
  // One shortcut getter per region, derived from the enum (add a region to the
  // enum → its getter appears on regenerate, no hand-edit).
  const regionGetters = Object.entries(Region)
    .map(
      ([key, value]) => `  /** The ${String(value).toUpperCase()} region. */
  get ${value}(): RegionClient {
    return this.region(Region.${key});
  }`,
    )
    .join("\n");

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
  type OnlinePayload,
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

${regionMethods}

  /** Server-wide live signals for this region. */
  get server(): ServerNamespace {
    return {
      online: (onData, onError) =>
        subscribeServerOnline(this.baseUrl, this.region, onData, onError),
    };
  }
}

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
    });
  }

  /** Scope to a region dynamically. */
  region(region: Region): RegionClient {
    return new RegionClient(this.api, this.baseUrl, this.fetchImpl, this.headers, region);
  }
${regionGetters}

${globalGetters}
}
`;
}

async function main() {
  const endpoints = await loadEndpoints();
  const targets = endpoints.map(classify).filter((t): t is Target => t !== null);
  const buckets = bucketize(targets);

  await mkdir(new URL(".", OUT), { recursive: true });
  await writeFile(OUT, render(buckets));

  console.log(
    `Generated ${targets.length} REST methods over ${RESOURCES.length} resources + ${GLOBALS.length} globals into generated/client.ts`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
