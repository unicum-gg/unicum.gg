# Drizzle migrations and the schema baseline

## TL;DR

- The reproducible schema baseline is **`drizzle/0012_baseline.sql`**. Applying it
  to an empty database recreates the entire current production structure (37 tables:
  12 per-region domain tables x 3 regions + `cron_leader`, all indexes, FKs, checks).
- `drizzle/meta/_journal.json` now contains a **single** entry: `0012_baseline`.
- **Never run `pnpm db:push`.** It DROPs every per-region table (factory pattern is
  invisible to drizzle-kit's AST). See the root `AGENTS.md` > Database migrations.

## Why this baseline exists (UNI-16)

Before this change, `meta/_journal.json` tracked only migration `0000`, while 12 SQL
files (`0000`-`0011`) sat on disk. Worse, `0000_material_ego.sql` describes the
**pre-factory** schema (plain `players` / `player_snapshots` / `tank_snapshots`,
with a `region` column) - not the per-region `eu_*` / `na_*` / `asia_*` tables that
production actually runs. The per-region factory refactor itself was never captured
in any committed migration; it was hand-applied to prod via `psql`. As a result the
schema could not be faithfully rebuilt from the repo, and a stale snapshot meant a
future `db:generate` could emit `DROP TABLE`. Blast radius: the whole DB.

`0012_baseline.sql` squashes `0000`-`0011` into one faithful, current-state baseline.

## How the baseline was produced (so it can be regenerated)

drizzle-kit's static analyzer cannot see tables created inside the `makeXxxTable(region)`
factories, so `pnpm db:generate` against the real schema only ever sees `cron_leader`.
To get faithful per-region DDL, the table instances were re-exported as top-level
consts (`eu_players`, `na_players`, ...) into a throwaway schema module and
`drizzle-kit generate` was run against that. drizzle's own renderer produced the 36
per-region `CREATE TABLE`/index/FK statements. The three
`*_snapshots_latest_membership_idx` partial covering indexes (`INCLUDE (...) WHERE
clan_id IS NOT NULL`, `... DESC`) cannot be expressed by drizzle-kit, so they are
carried over verbatim from `0011_snapshots_latest_membership_idx.sql`.

The result was applied to a throwaway Postgres engine (PGlite) to prove it runs
clean: 85 statements, 37 tables, 79 indexes, 6 FKs, the `cron_leader` singleton
CHECK, and an `eu_players` insert round-trip.

## Why `meta/0012_snapshot.json` only lists `cron_leader`

The drizzle snapshot is intentionally kept to what drizzle-kit can actually see from
the real factory schema (only `cron_leader`). This is the **safe** choice: a future
`pnpm db:generate` diffs `cron_leader` (snapshot) vs `cron_leader` (visible schema)
and is a clean no-op - it never proposes `DROP TABLE` for the 36 factory tables it
cannot see. If the snapshot instead listed all 37 tables, `db:generate` would diff
"37 tables" vs "1 visible" and emit 36 DROPs (the same disaster as `db:push`).

`0012_snapshot.json` chains off the original `0000_snapshot.json` (`prevId` points at
its id) so the snapshot chain validates and `db:generate` does not abort.

## Reproduce the schema on an empty database

```bash
createdb unicum_fresh
psql "$DATABASE_URL_FRESH" -f drizzle/0012_baseline.sql
# or: pnpm db:migrate   (runs the single journal entry, 0012_baseline)
```

## Adding a future migration

drizzle-kit stays blind to the factory tables, so `db:generate` will keep reporting
"no changes" for per-region edits. Continue to **hand-write** the SQL:

1. Edit `src/services/db/schema/<file>.ts`.
2. Create `drizzle/0013_<name>.sql` by hand (next index after the baseline).
3. Apply with `psql "$DATABASE_URL" -f drizzle/0013_<name>.sql` (use `CREATE INDEX
   CONCURRENTLY` for big tables; it cannot run inside a transaction).
4. Add a matching entry to `meta/_journal.json` (`idx: 13`, `tag: "0013_<name>"`).

## Historical files (`0000`-`0011`)

Kept on disk as real history but **not** referenced by the journal. They describe a
mix of the pre-factory and early per-factory schema and must **not** be replayed
against production. Treat `0012_baseline.sql` as the only authoritative starting point.

## Production reconciliation (requires psql access - see UNI-16 escalation)

Production was built by hand and is tracked by drizzle in the `__drizzle_migrations`
table, not by `_journal.json`. Two follow-up steps need a `psql`/`pg_dump` operator:

1. **Verify fidelity (read-only):**
   `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL"` and diff the
   structure against `0012_baseline.sql`. Reconcile any drift the repo could not know
   about (objects hand-applied to prod but never committed).
2. **Make `db:migrate` a no-op on prod (one-time):** register the baseline as already
   applied so migrate never tries to re-run it against the live (populated) DB.
   Do NOT run `0012_baseline.sql` against production - it already has these tables.
