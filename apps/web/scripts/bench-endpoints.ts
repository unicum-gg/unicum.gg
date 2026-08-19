/**
 * Cold-start speed bench for every documented GET endpoint.
 *
 * The endpoint list is NOT hand-maintained: it is derived from the served
 * OpenAPI spec (`openapi.generated.json`), so a new documented route is
 * benched automatically the moment it exists. For each endpoint we hit the API
 * cold (first request) then warm (second), and read the `Server-Timing` header
 * the `measured()` wrapper stamps, so the ranking is by real server CPU
 * (`cpu`), not just wall time. That is the number that decides throughput and
 * the one to optimise first.
 *
 * Run it against a LOCAL PRODUCTION BUILD (routes precompiled, no dev-compile
 * noise) with Redis ON so the sub-caches (wot-src, encyclopedia, WN-expected)
 * are warm like prod, and PERF_BYPASS_PAYLOAD_CACHE=1 so the per-entity payload
 * caches (player/tank detail) MISS and the handler actually assembles. That is
 * the representative "cache-miss with warm sub-caches" cost. Running with Redis
 * off instead over-penalises endpoints whose heavy work is Redis-cached (a cold
 * wot-src re-parse can read as ~20x its real prod cpu).
 *
 * Usage (from apps/web, after `pnpm build`):
 *   ( cd .next/standalone/apps/web && HOSTNAME=127.0.0.1 PORT=3000 \
 *     PERF_BYPASS_PAYLOAD_CACHE=1 RUN_CRONS=0 \
 *     node --env-file=../../../.env.local server.js & )
 *   BENCH_BASE_URL=http://localhost:3000/api node --import tsx scripts/bench-endpoints.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = (
  process.env.BENCH_BASE_URL ?? "http://localhost:3000/api"
).replace(/\/$/, "");
const SPEC_PATH = join(
  process.cwd(),
  "src/services/openapi/openapi.generated.json",
);
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS ?? 30000);

// Sample values for path/query params, keyed by param name. `slug` is
// context-sensitive (a tank slug vs a map slug), so it is resolved per path.
const SAMPLES: Record<string, string> = {
  region: "eu",
  nickname: "gnom1tamkista",
  tag: "FAME",
  q: "is",
  names: "gnom1tamkista,Orzanel",
  tags: "FAME,YOUJO",
  granularity: "daily",
  players: "true",
  clans: "true",
  tanks: "true",
  maps: "true",
};

function sampleFor(name: string, path: string): string | null {
  if (name === "slug") return path.includes("/maps/") ? "himmelsdorf" : "is-7";
  return SAMPLES[name] ?? null;
}

type ParamSpec = { name: string; in: "path" | "query"; required?: boolean };
type Endpoint = { path: string; params: ParamSpec[] };

function loadGetEndpoints(): Endpoint[] {
  const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as {
    paths: Record<string, { get?: { parameters?: ParamSpec[] } }>;
  };
  const out: Endpoint[] = [];
  for (const [path, ops] of Object.entries(spec.paths)) {
    if (!ops.get) continue;
    // SSE and NDJSON are streams, not awaitable JSON responses; they would hang.
    if (path.endsWith("/sse") || path.endsWith("/ndjson")) continue;
    out.push({ path, params: ops.get.parameters ?? [] });
  }
  return out;
}

// Build a concrete URL, filling path params and required query params from the
// sample map. Returns null (skip) when a required param has no known sample.
function buildUrl(ep: Endpoint): string | null {
  let path = ep.path;
  const query: string[] = [];
  for (const p of ep.params) {
    const val = sampleFor(p.name, ep.path);
    if (p.in === "path") {
      if (val === null) return null;
      path = path.replace(`{${p.name}}`, encodeURIComponent(val));
    } else if (p.required) {
      if (val === null) return null;
      query.push(`${p.name}=${encodeURIComponent(val)}`);
    }
  }
  const qs = query.length ? `?${query.join("&")}` : "";
  return `${BASE_URL}${path}${qs}`;
}

type Timing = { total?: number; cpu?: number; spans: { name: string; dur: number }[] };

function parseServerTiming(header: string | null): Timing {
  const t: Timing = { spans: [] };
  if (!header) return t;
  for (const part of header.split(",")) {
    const seg = part.trim();
    const dur = Number(seg.match(/dur=([0-9.]+)/)?.[1]);
    if (!Number.isFinite(dur)) continue;
    if (seg.startsWith("total")) t.total = dur;
    else if (seg.startsWith("cpu")) t.cpu = dur;
    else {
      const desc = seg.match(/desc="([^"]*)"/)?.[1];
      if (desc) t.spans.push({ name: desc, dur });
    }
  }
  t.spans.sort((a, b) => b.dur - a.dur);
  return t;
}

type Result = {
  path: string;
  url: string;
  status: number | "error";
  coldMs: number;
  warmMs: number;
  // Server-Timing from the cold (first) and warm (second) hit. In a dev server
  // the first hit of a route also compiles it, inflating its cpu, so the warm
  // reading is the clean compute cost and what the cpu ranking uses.
  timing: Timing;
  timingWarm: Timing;
};

async function hit(url: string): Promise<{ ms: number; status: number | "error"; header: string | null }> {
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    clearTimeout(timer);
    // Drain the body so timing includes full transfer, not just headers.
    await res.arrayBuffer();
    return {
      ms: performance.now() - t0,
      status: res.status,
      header: res.headers.get("server-timing"),
    };
  } catch {
    return { ms: performance.now() - t0, status: "error", header: null };
  }
}

async function main(): Promise<void> {
  const endpoints = loadGetEndpoints();
  const results: Result[] = [];
  const skipped: string[] = [];

  const urls = endpoints
    .map((ep) => buildUrl(ep))
    .filter((u): u is string => u !== null);

  // Warmup: a dev server compiles each route on its first hit (Turbopack), which
  // would otherwise land on the cold measurement. Compile them all up front,
  // concurrently, so the measured pass sees precompiled routes. No-op cost
  // against a production build. Skipped with BENCH_NO_WARMUP=1.
  if (process.env.BENCH_NO_WARMUP !== "1") {
    console.log(`Warming up ${urls.length} routes (compiling)...`);
    await Promise.allSettled(urls.map((u) => hit(u)));
  }

  console.log(`\nBenching ${endpoints.length} GET endpoints against ${BASE_URL}\n`);
  for (const ep of endpoints) {
    const url = buildUrl(ep);
    if (!url) {
      skipped.push(ep.path);
      continue;
    }
    const cold = await hit(url);
    const warm = await hit(url);
    const r: Result = {
      path: ep.path,
      url,
      status: cold.status,
      coldMs: Math.round(cold.ms),
      warmMs: Math.round(warm.ms),
      timing: parseServerTiming(cold.header),
      timingWarm: parseServerTiming(warm.header),
    };
    results.push(r);
    const cpu = r.timingWarm.cpu !== undefined ? `${r.timingWarm.cpu.toFixed(0)}ms cpu` : "no cpu";
    console.log(
      `  ${String(r.status).padEnd(5)} cold ${String(r.coldMs).padStart(6)}ms  warm ${String(r.warmMs).padStart(6)}ms  ${cpu.padStart(10)}  ${r.path}`,
    );
  }

  const ok = results.filter((r) => typeof r.status === "number" && r.status < 400);
  const line = (r: Result) => {
    const cpu = r.timingWarm.cpu !== undefined ? `${r.timingWarm.cpu.toFixed(0)}ms` : "  -  ";
    const top = r.timingWarm.spans[0] ? ` [${r.timingWarm.spans[0].name} ${r.timingWarm.spans[0].dur.toFixed(0)}ms]` : "";
    return `  ${String(r.warmMs).padStart(6)}ms warm  cpu ${cpu.padStart(7)}  ${r.path}${top}`;
  };

  console.log("\n================ SLOWEST (warm wall time) ================");
  for (const r of [...ok].sort((a, b) => b.warmMs - a.warmMs).slice(0, 20)) console.log(line(r));

  const withCpu = ok.filter((r) => r.timingWarm.cpu !== undefined);
  console.log(`\n================ HEAVIEST (server cpu, warm) ${withCpu.length}/${ok.length} instrumented ================`);
  for (const r of withCpu.sort((a, b) => (b.timingWarm.cpu ?? 0) - (a.timingWarm.cpu ?? 0)).slice(0, 20)) console.log(line(r));

  const errors = results.filter((r) => r.status === "error" || (typeof r.status === "number" && r.status >= 400));
  if (errors.length) {
    console.log("\n================ NON-2xx / ERROR ================");
    for (const r of errors) console.log(`  ${String(r.status).padEnd(6)} ${r.path}`);
  }
  if (skipped.length) console.log(`\nSkipped (no sample for a required param): ${skipped.join(", ")}`);

  const outPath = join(process.cwd(), "bench-endpoints.json");
  const fs = await import("node:fs");
  fs.writeFileSync(outPath, JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  console.log(`\nFull results -> ${outPath}`);
  process.exit(0);
}

void main();
