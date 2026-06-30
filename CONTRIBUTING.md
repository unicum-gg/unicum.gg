# Contributing

Read [`AGENTS.md`](./AGENTS.md) first. It contains the non-obvious repo rules that matter for safe changes.

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

`pnpm dev` starts the Next.js app and the cron loop via `src/instrumentation.ts`.

## Database

Apply migrations manually:

```bash
for f in drizzle/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Do not use `pnpm db:push`. It is intentionally disabled because the schema uses per-region table factories and drizzle-kit can emit destructive `DROP TABLE ... CASCADE` SQL.

If you change a schema file under `src/services/db/schema/`:

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

- Routes are region-aware. Most public pages live under `src/app/[region]/...`.
- The app is intentionally eventual-consistent: render from cache, refresh in the background, update via SSE.
- Wargaming and portal APIs are rate-limited and can throttle hard through G-Core CDN.
- The repo uses generated OpenAPI output. `postinstall`, `predev`, and `prebuild` regenerate it automatically.
