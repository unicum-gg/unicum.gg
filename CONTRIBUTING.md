# Contributing

Read [`AGENTS.md`](./AGENTS.md) first. It contains the non-obvious repo rules that matter for safe changes.

## Repo layout

pnpm workspace with one-way dependencies, no cycles:

```
@unicum.gg/wargaming ──▶ @unicum.gg/shared ──▶ @unicum.gg/core ──▶ apps/web (API routes) + apps/worker
                                                       │ HTTP API
                                @unicum.gg/sdk ◀───────┘
                                       └──▶ web front (pages, SSR included) + apps/bot
```

- `packages/wargaming` — neutral Wargaming API SDK. Import from the barrel: `import { Region } from "@unicum.gg/wargaming"`.
- `packages/shared` — client-safe code only (env, constants, db schema, pure domain math and types). Also barrel-imported: `import { PlayerDetailData } from "@unicum.gg/shared"`. Never add anything here that opens a connection or imports Node-only APIs.
- `packages/core` — server-only (db pool, redis, crons, repositories, WG fetchers, auth). Not a barrel on purpose: modules have import-time side effects, so import the precise subpath (`@unicum.gg/core/db`, `@unicum.gg/core/players`, ...). Client components must never import it.
- `packages/sdk` — fluent client for our own public API (types generated from the OpenAPI spec). The web front end and the Discord bot fetch through it; never write raw `fetch` calls against our own API.
- `apps/web` (site + API), `apps/worker` (crons), `apps/bot` (Discord — a pure SDK client, no core/db access).

Inside `apps/web` the same one-way rule applies: only `app/api/**` (plus the og-image/sitemap/auth routes and the API-side `services/*` helpers) imports `core` by value. Pages and components (server-rendered ones included) fetch through the public API via `@unicum.gg/sdk`, exactly like the bot. `import type` from core is fine (erased at build). If a page needs data no endpoint serves yet, add the endpoint first, then consume it through the SDK.

Rule of thumb for new code: pure logic or a type a client component needs goes in `shared`; anything touching db/redis/WG goes in `core`; a mixed module keeps the server function in `core` and re-exports the type from `shared`.

## Prerequisites

- Node.js 22+
- `pnpm`
- PostgreSQL
- Wargaming application IDs for `eu`, `na`, and `asia`
- `DATABASE_URL`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Install

```bash
pnpm install
pnpm env:init
```

`pnpm env:init` generates `.env.local` from `env.ts`. Fill in the values after it creates the file.

If you already have a `.env.local`, the script backs it up first.

## Run

```bash
pnpm dev
```

`pnpm dev` starts the Next.js app (from `apps/web`) and, in local dev, the cron loop via its `src/instrumentation.ts`. In production the crons run in `apps/worker` instead.

## Superset workspaces (optional)

If you use [Superset](https://docs.superset.sh) to spin up isolated git-worktree workspaces, `.superset/config.json` wires the lifecycle for you:

- **setup** (`.superset/setup.sh`, on workspace create): `pnpm install --frozen-lockfile`, then copies `apps/web/.env.local` and `apps/bot/.env.local` from the root checkout (`$SUPERSET_ROOT_PATH`).
- **run** (Run button): `RUN_CRONS=0 pnpm dev`, the web dev server without a second cron loop, since the DB and Redis are shared.

The env copy only works if the root checkout already holds the secrets. On a fresh clone those files are absent, so setup logs `skip ... absent from root checkout` and you fall back to `pnpm env:init` as above. This is entirely optional and unrelated to the standard `pnpm install` / `pnpm dev` flow.

## Database

Apply migrations manually:

```bash
for f in apps/web/drizzle/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Do not use `pnpm db:push`. It is intentionally disabled because the schema uses per-region table factories and drizzle-kit can emit destructive `DROP TABLE ... CASCADE` SQL.

If you change a schema file under `packages/shared/src/db/schema/`:

1. Run `pnpm db:generate`
2. Review the generated SQL carefully
3. Apply it with `psql`

## Validation

There is no test suite.

Use:

```bash
pnpm lint
npx tsc --noEmit --skipLibCheck
```

for the main automated checks.

## Commit and PR Titles

Use the onRuntime gitmoji commit convention for every commit and PR title:

```text
<gitmoji> <type> <description> [(#<issue>)]
```

Reference: https://onruntime.com/docs/gitmoji

Rules:

- Use a lowercase, imperative description.
- Keep each commit to one logical change.
- Use exactly one of these types: `add`, `fix`, `improve`, `update`, `remove`, `refactor`, `rename`, `move`, `upgrade`, `downgrade`, `release`.
- Do not derive the type from the gitmoji name.
- Do not add signatures, generated-by notices, or co-author footers.

Examples:

```text
📝 add contributing guide
🐛 fix clan search cache key (#42)
```

## Common Gotchas

- Routes are region-aware. Most public pages live under `apps/web/src/app/[region]/...`.
- The app is intentionally eventual-consistent: render from cache, refresh in the background, update via SSE.
- Wargaming and portal APIs are rate-limited and can throttle hard through G-Core CDN.
- The repo uses generated OpenAPI output. `postinstall`, `predev`, and `prebuild` regenerate it automatically.
