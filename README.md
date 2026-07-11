# unicum.gg

Free, open-source World of Tanks stats tracker. Player profiles, clan pages, leaderboards. WN7, WN8, WNX. No ads.

Live at [unicum.gg](https://unicum.gg).

## Stack

Next.js 16, React 19, TypeScript, PostgreSQL via Drizzle, Tailwind v4, shadcn/ui, Recharts.

## Run locally

```bash
pnpm install
pnpm env:init   # generates .env.local from env.ts; fill in the values
pnpm dev
```

`pnpm env:init` reads `env.ts` and writes a `.env.local` with every required key. If a `.env.local` already exists it is backed up to `.env.local.<timestamp>.bak` first, so nothing is lost.

Get the three WG application IDs at [developers.wargaming.net](https://developers.wargaming.net) (one ID can be reused across regions).

### Database

```bash
for f in drizzle/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

## Contributing

Issues and PRs welcome. **Read [AGENTS.md](./AGENTS.md) first.** It is the project's contributing guide and covers the non-obvious foot-guns (schema factory pattern, migration workflow, cron loop, WG fetch and rate limits).

## License

[AGPL v3](./LICENSE). Copyright (C) 2026 Antoine Kingue.

Not affiliated with Wargaming.net.
