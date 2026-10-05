/**
 * Apply one migration file, with a dry run that leaves nothing behind.
 *
 * There is no development database (see AGENTS.md), so the only reachable
 * Postgres is production, and `psql` is not on this machine. DDL is
 * transactional in Postgres, so `--dry` runs the whole file and rolls it back:
 * the same parse, the same checks, nothing kept.
 *
 *   node scripts/apply-sql.mjs apps/web/drizzle/0120_battles.sql --dry
 *   node scripts/apply-sql.mjs apps/web/drizzle/0120_battles.sql
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
// pnpm keeps dependencies in the package that declares them, and this script
// runs from the repo root, so the driver is resolved by path.
const { default: postgres } = await import(
  pathToFileURL(path.join(process.cwd(), "packages/core/node_modules/postgres/src/index.js")).href
);

const args = process.argv.slice(2);
const dry = args.includes("--dry");
// Found by shape rather than by position: `--dry` first used to land in
// argv[2] and be read as the filename, which crashed on an unguarded read
// instead of doing the dry run that was asked for.
const file = args.find((arg) => !arg.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/apply-sql.mjs <file.sql> [--dry]");
  process.exit(1);
}

// The environment first, so this is usable outside a checkout (CI, a
// one-off shell) and not only next to apps/web/.env.local.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), "apps/web/.env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) {
    console.error("no DATABASE_URL in the environment or apps/web/.env.local");
    process.exit(1);
  }
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}
const url = databaseUrl();
const host = new URL(url).host;

const text = fs.readFileSync(file, "utf8");
const sql = postgres(url, { max: 1, onnotice: (n) => console.log("  notice:", n.message) });

const name = (t) => t.replace(/_\d{4}_\d{2}$/, "_<month>");

try {
  console.log(`  database: ${host}`);
  console.log(`  file    : ${file} (${text.length} bytes)`);
  console.log(`  mode    : ${dry ? "DRY RUN, rolled back at the end" : "APPLYING FOR REAL"}`);

  await sql.begin(async (tx) => {
    await tx.unsafe(text).simple();

    const tables = await tx`
      SELECT c.relname AS name, c.relkind AS kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname LIKE '%_battles%'
      ORDER BY c.relname`;
    const kinds = {};
    for (const row of tables) {
      const key = `${row.kind}:${name(row.name)}`;
      kinds[key] = (kinds[key] || 0) + 1;
    }
    console.log(`  objects : ${tables.length} named like 'battles'`);
    for (const [key, count] of Object.entries(kinds).sort()) {
      const [kind, label] = key.split(":");
      const what = { p: "partitioned table", r: "partition", v: "view", I: "partitioned index", i: "index" }[kind] || kind;
      console.log(`     ${String(count).padStart(3)}  ${what.padEnd(20)} ${label}`);
    }

    if (dry) throw new Error("__rollback__");
  });
  console.log("  applied.");
} catch (error) {
  if (error.message === "__rollback__") {
    console.log("  dry run rolled back, nothing was kept.");
  } else {
    console.error("  FAILED:", error.message);
    if (error.position) console.error("  at position:", error.position);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
