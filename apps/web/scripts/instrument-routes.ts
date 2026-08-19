/**
 * One-shot codemod: wrap every DOCUMENTED GET route handler in `measured()` so
 * each response carries a `Server-Timing` header (total/cpu/spans). The list of
 * routes is derived from the OpenAPI spec, so only public documented endpoints
 * are touched (internal/cron routes are left alone).
 *
 * The transform keeps the exported `export async function GET` shape that
 * next-openapi-gen detects, and keeps its `@openapi` JSDoc attached to it, by
 * inserting an exported wrapper right after the JSDoc and renaming the original
 * body to `GET__perf`. Signatures are forwarded untouched via
 * `...args: Parameters<typeof GET__perf>`, so no per-route signature surgery.
 *
 *   before:  <JSDoc>\n export async function GET(<sig>) { <body> }
 *   after:   <JSDoc>\n export async function GET(...args: Parameters<typeof GET__perf>) {
 *              return measured("GET <path>", () => GET__perf(...args));
 *            }
 *            async function GET__perf(<sig>) { <body> }
 *
 * Run:  node --import tsx scripts/instrument-routes.ts        (writes files)
 *       node --import tsx scripts/instrument-routes.ts --dry  (prints plan only)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();
const SPEC_PATH = join(ROOT, "src/services/openapi/openapi.generated.json");

function routeFileForPath(apiPath: string): string {
  // /{region}/tanks/{slug}/detail -> src/app/api/[region]/tanks/[slug]/detail/route.ts
  const segs = apiPath
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/^\{(.+)\}$/, "[$1]"));
  return join(ROOT, "src/app/api", ...segs, "route.ts");
}

function ensureMeasuredImport(src: string): string {
  if (/from\s+["']@\/services\/perf["']/.test(src)) return src;
  // Insert after the last import statement.
  const importRe = /^import[\s\S]*?;$/gm;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src))) last = m;
  const line = `import { measured } from "@/services/perf";`;
  if (!last) return `${line}\n${src}`;
  const at = last.index + last[0].length;
  return `${src.slice(0, at)}\n${line}${src.slice(at)}`;
}

function main(): void {
  const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as {
    paths: Record<string, { get?: unknown }>;
  };
  const getPaths = Object.entries(spec.paths)
    .filter(([, ops]) => ops.get)
    .map(([p]) => p)
    // Streams (SSE powers LiveSync, NDJSON powers search): must not be wrapped,
    // `measured()` re-wraps the body and would break streaming.
    .filter((p) => !p.endsWith("/sse") && !p.endsWith("/ndjson"))
    // OG image routes are `.tsx` returning ImageResponse (a different concern);
    // handle separately. /health is a sync healthcheck (Coolify polls it) with
    // nothing to measure.
    .filter((p) => !p.startsWith("/og") && p !== "/health");

  const done: string[] = [];
  const already: string[] = [];
  const missing: string[] = [];
  const noMatch: string[] = [];

  for (const apiPath of getPaths) {
    const file = routeFileForPath(apiPath);
    if (!existsSync(file)) {
      missing.push(`${apiPath}  (${file.replace(ROOT + "/", "")})`);
      continue;
    }
    let src = readFileSync(file, "utf8");
    if (src.includes("measured(")) {
      already.push(apiPath);
      continue;
    }
    const marker = "export async function GET(";
    if (!src.includes(marker)) {
      noMatch.push(`${apiPath}  (no 'export async function GET(')`);
      continue;
    }
    const label = `GET ${apiPath}`;
    const wrapper =
      `export async function GET(...args: Parameters<typeof GET__perf>) {\n` +
      `  return measured(${JSON.stringify(label)}, () => GET__perf(...args));\n` +
      `}\n` +
      `async function GET__perf(`;
    // Replace only the first occurrence (a route file has one GET).
    src = src.replace(marker, wrapper);
    src = ensureMeasuredImport(src);
    if (DRY) {
      done.push(apiPath);
    } else {
      writeFileSync(file, src);
      done.push(apiPath);
    }
  }

  console.log(`${DRY ? "[DRY] " : ""}instrumented ${done.length} routes`);
  for (const d of done) console.log(`  + ${d}`);
  if (already.length) console.log(`\nalready instrumented (${already.length}): ${already.join(", ")}`);
  if (noMatch.length) console.log(`\nNO MATCH (${noMatch.length}):\n  ${noMatch.join("\n  ")}`);
  if (missing.length) console.log(`\nMISSING FILE (${missing.length}):\n  ${missing.join("\n  ")}`);
}

main();
