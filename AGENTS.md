<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server. Also starts the cron loop via `src/instrumentation.ts` (snapshot, refresh, discovery). |
| `pnpm build` / `pnpm start` | Production build / start. |
| `pnpm lint` | ESLint. There is no test runner in the project. |
| `pnpm env:init` | Generate `.env.local` from `env.ts`. Backs up any existing file to `.env.local.<timestamp>.bak`. |
| `pnpm db:generate` | Drizzle-kit generate. Always review the SQL it emits (see [Database migrations](#database-migrations)). |
| `pnpm db:migrate` | Often a no-op: the journal is out of sync with disk, so apply migrations manually via `psql "$DATABASE_URL" -f drizzle/000N_*.sql` instead. |
| `npx tsc --noEmit --skipLibCheck` | Type-check the project. Use this rather than `pnpm build` when iterating on types. |

There is no test suite. Validation is type checking plus ESLint plus manual smoke in the browser.

# Database migrations

**NEVER suggest or run `pnpm db:push` (= `drizzle-kit push`).** The script is intentionally poisoned in `package.json` and will fail loudly. Reason: our `src/services/db/schema/*.ts` files use a `makeXxxTable(region)` factory pattern (e.g. `playersByRegion = { eu: makePlayersTable("eu"), ... }`). Drizzle-Kit's AST analyzer only detects top-level `pgTable(...)` exports and cannot see tables hidden inside factory call bodies. `db:push` therefore concludes that every `eu_*`/`na_*`/`asia_*` table is orphan and emits `DROP TABLE ... CASCADE` for all of them. **This has already wiped the production DB once. Don't do it twice.**

The correct workflow for any schema change:

1. Edit `src/services/db/schema/<file>.ts`
2. `pnpm db:generate` so drizzle-kit emits a new SQL file in `drizzle/000N_*.sql`
3. **Review the generated SQL.** If you see unexpected `DROP TABLE` on per-region tables, the factory pattern bit you again. Stop, do not apply, and write the migration by hand instead.
4. Apply via `psql "$DATABASE_URL" -f drizzle/000N_*.sql`. Drizzle-kit tracks applied migrations in the `__drizzle_migrations` table on the DB; the `_journal.json` on disk is out of sync and is not authoritative.

# Big picture

## Per-region table factory

`src/services/db/schema/*.ts` exports `makeXxxTable(region)` factories rather than top-level `pgTable(...)` calls. Every domain table physically exists three times (`eu_*`, `na_*`, `asia_*`). Consumers index into a `Record<Region, Table>` map (e.g. `playersByRegion[region]`). See the migration section above for the consequences.

## Cron loop

Crons start from `src/instrumentation.ts` on Node runtime boot, with a `globalThis.__cronStarted` guard to avoid double-start under HMR. Every job is scheduled per region rather than globally, so a slow region cannot starve the others (EU's G-Core throttling used to cascade into NA/Asia skipping their ticks).

| Cron | Source | Cadence |
|---|---|---|
| `snapshot-cron-<region>` | `services/players/backfill-cron.ts` | Every minute. Refreshes up to 200 players whose last snapshot is older than 24h. |
| `player-cron-<region>` | `services/players/refresh-cron.ts` | Every 10s. Drains the on-demand player refresh queue (page hits enqueue at priority 10). |
| `clan-refresh-cron-<region>` | `services/clans/refresh-cron.ts` | Every 10s. Drains on-demand clan refresh queue. |
| `clan-backfill-cron-<region>` | `services/clans/backfill-cron.ts` | Every minute. Re-fetches the oldest tracked clans. |
| `discovery-cron` | `services/discovery/cron.ts` | Weekly (Sundays 04:00) walk of clan member lists to find new account IDs. |
| `vehicles-cron` | `services/discovery/cron.ts` | Daily (07:00) refresh of the vehicle catalogue from the IzeBerg/wot-src mirror. Runs after IzeBerg's typical push window (Tue/Thu 02:30-07:00 UTC, mostly ~04:30) so we never miss a release-day update. |
| `top-*-cron` | `services/wargaming/wot/{players,clans}/top/cron.ts` | Nightly leaderboard precompute. |

## Wargaming fetch layer

`src/services/wargaming/wot/fetch.ts` wraps every WG call with a per-region token-bucket rate limiter defined in `src/services/wargaming/wot/rate-limit.ts`. The empirical caps sit well below WG's official 20 RPS because traffic actually hits G-Core CDN IPs (geo-routed DNS), which throttle more aggressively:

- WG API: EU = 4 RPS, NA = 6 RPS, Asia = 6 RPS
- Clan portal (newsfeeds): 1 RPS per region

Three application IDs (one per region) live in `env.ts` and are required at boot. They can all be the same string in practice, but the env names are kept separate to make rotation possible.

Batched endpoints (`getPlayersInfoBatch`, `getTanksStatsBatch`, `getAccountsWTRBatch`) chunk inputs to fit WG's per-request `account_id` limit and bisect on `INVALID_ACCOUNT_ID` so a single deleted account does not poison a full chunk.

## Player page render path

`src/app/[region]/players/[nickname]/page.tsx` is stale-while-revalidate:

1. Read everything available from the DB (`loadPlayerInitialData`).
2. If we have at least the player row and the latest snapshot, render immediately from cache and enqueue an on-demand refresh in the background.
3. If the DB is cold for that account, fetch live from WG and write back before rendering.

`LiveSync` (SSE channel in `src/services/live/`) lets the browser hot-swap fresh data without a manual reload once the background refresh lands.

## Analytics consent

Two tiers, both in `src/components/script/index.tsx`:

- Umami loads unconditionally in production. Cookieless, EU-hosted, treated as legitimate-interest internal analytics.
- GA4 only loads after the user accepts via the cookie banner.

The `CookieConsent` context in `src/contexts/cookie-consent.tsx` writes the consent state to `localStorage` under the `unicum.*` namespace and broadcasts via synthetic `StorageEvent` so every subscribed component reacts on the same tab.

## Region-prefixed routes

Public routes live under `src/app/[region]/...`. The region is part of the path, never a query param. The home page `src/app/page.tsx` and a couple of region-less routes (e.g. `/coverage`) read the region from a cookie (`STORAGE.COOKIES.REGION`) and either redirect or render region-aware content client-side.

# Conventions

- Enums over union types or `as const` arrays. The codebase uses real TypeScript `enum` declarations consistently (`enum SortColumn`, `enum RatingMetric`, etc.).
- No section divider comments (e.g. `// ─── X ───`). Split the file instead.
- English only in code, comments, UI strings, and Intl locales.
- ESLint, not Biome. Never emit `// biome-ignore ...` directives.
- shadcn-style `src/components/ui/*` for primitives. Local components compose them, never reach into Radix directly.
- WG and G-Core failures are part of normal operation, not exceptions. The fetch and cron layers retry, bisect, and dequeue rather than throwing.
