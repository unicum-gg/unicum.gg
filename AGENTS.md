<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database migrations

**NEVER suggest or run `pnpm db:push` (= `drizzle-kit push`).** The script is intentionally poisoned in `package.json` and will fail loudly. Reason: our `src/services/db/schema/*.ts` files use a `makeXxxTable(region)` factory pattern (e.g. `playersByRegion = { eu: makePlayersTable("eu"), ... }`). Drizzle-Kit's AST analyzer only detects top-level `pgTable(...)` exports and cannot see tables hidden inside factory call bodies. `db:push` therefore concludes that every `eu_*`/`na_*`/`asia_*` table is orphan and emits `DROP TABLE ... CASCADE` for all of them. **This has already wiped the production DB once — don't do it twice.**

The correct workflow for any schema change:

1. Edit `src/services/db/schema/<file>.ts`
2. `pnpm db:generate` → drizzle-kit emits a new SQL file in `drizzle/000N_*.sql`
3. **Review the generated SQL.** If you see unexpected `DROP TABLE` on per-region tables, the factory pattern bit you again — stop, do not apply, and write the migration by hand instead.
4. `pnpm db:migrate` to apply (or `psql "$DATABASE_URL" -f drizzle/000N_*.sql` for one-off application). drizzle-kit tracks applied migrations in the `__drizzle_migrations` table.
