# unicum.gg

Free, open-source World of Tanks stats tracker. Player profiles, clan pages, leaderboards, battles and replays. WN7, WN8, WNX, plus Wargaming's PR and WTR. No ads, in 36 languages.

Live at [unicum.gg](https://unicum.gg).

## Use it

- [Player stats](https://unicum.gg/players): rating leaderboards over 24h, 7 days, 30 days and lifetime, per-tank records, per-mode breakdowns, [Marks of Excellence](https://unicum.gg/players/marks)
- [Clan stats](https://unicum.gg/clans): rankings, members, [Stronghold](https://unicum.gg/clans/stronghold) and Clan Wars
- Event boards: [Onslaught](https://unicum.gg/players/onslaught), [Maneuvers](https://unicum.gg/players/maneuvers), [Rampage](https://unicum.gg/players/rampage)
- [Tank stats](https://unicum.gg/tanks): specifications, a 3D viewer with armour, loadouts players actually run, community ratings, buffs and nerfs across updates
- [Battles](https://unicum.gg/battles): recorded battles and replays, uploaded by the mod
- [Tournaments](https://unicum.gg/tournaments): brackets, rosters and placements, linked to the players and clans who played them
- [Events calendar](https://unicum.gg/calendar): every official event, tournament, livestream, sale and update, kept once Wargaming takes it down, and announced in the Discord's `#events`
- [Maps](https://unicum.gg/maps), [server population](https://unicum.gg/servers) and a [glossary](https://unicum.gg/glossary)
- [Public API](https://unicum.gg/docs): the same data the site reads, documented with OpenAPI
- [Discord bot](https://unicum.gg/bot): `/player` and `/clan`

## Mod

The [unicum.gg mod](https://unicum.gg/mod) shows every player's rating and clan languages in battle, on the Tab and loading screens and in the battle results. Free and open source ([unicum-gg/unicum.gg-mod](https://github.com/unicum-gg/unicum.gg-mod)), also published on [wgmods.net](https://wgmods.net).

## MCP server

Every API endpoint is also a tool on a remote MCP server, no key needed. It is listed in the [official MCP Registry](https://registry.modelcontextprotocol.io) as `gg.unicum/wot-stats`.

```json
{
  "mcpServers": {
    "unicum": { "url": "https://unicum.gg/api/mcp" }
  }
}
```

## Stack

Next.js 16, React 19, TypeScript, PostgreSQL via Drizzle, Tailwind v4, shadcn/ui, Recharts.

## Monorepo

pnpm workspace. Dependencies flow one way, no cycles:

```
@unicum.gg/wargaming ──▶ @unicum.gg/shared ──▶ @unicum.gg/core ──▶ apps/web (server) + apps/worker
                                                       │ HTTP API
                                @unicum.gg/sdk ◀───────┘
                                       └──▶ web front + apps/bot
```

| Package / app | Role |
|---|---|
| `packages/wargaming` | Neutral Wargaming API SDK (client, rate limiting, full response types) |
| `packages/shared` | Client-safe foundations: env, constants, db schema, pure domain math and types |
| `packages/core` | Server-only: db pool, redis, crons, repositories, WG fetchers, auth |
| `packages/sdk` | Fluent client for our own public API, types generated from the OpenAPI spec |
| `apps/web` | The Next.js site and public API |
| `apps/worker` | Standalone cron runner |
| `apps/bot` | Discord bot (`/player`, `/clan`), a pure SDK client |
| `apps/proxy` | Forward proxy pinning the egress IP of Wargaming traffic |
| `apps/sentinel` | Turns the Cloudflare challenge on when the web cannot keep up |
| `apps/wgmods` | Publishes the mod's GitHub releases to wgmods.net |

`wargaming`, `shared` and `sdk` are imported from their package barrel (`import { Region } from "@unicum.gg/wargaming"`). `core` is consumed through subpaths: its modules have import-time side effects (db pool, auth secret assert), so server code imports the specific one it needs (`@unicum.gg/core/db`, ...), and its root barrel only re-exports side-effect-free bits. The front end and the Discord bot never import `core`; they consume the API through `@unicum.gg/sdk` and types through `@unicum.gg/shared`.

## Run locally

```bash
pnpm install
pnpm env:init   # generates .env.local from env.ts; fill in the values
pnpm dev
```

`pnpm env:init` reads `env.ts` and writes a `.env.local` with every required key. If a `.env.local` already exists it is backed up to `.env.local.<timestamp>.bak` first, so nothing is lost.

Get the three WG application IDs at [developers.wargaming.net](https://developers.wargaming.net) (one ID can be reused across regions).

Translations: write the English strings under `apps/web/src/locales/en/`, the other 35 languages are filled in by CI on `main`. Never run the translator locally.

### Database

```bash
for f in apps/web/drizzle/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

## Contributing

Issues and PRs welcome. **Read [AGENTS.md](./AGENTS.md) first.** It is the project's contributing guide and covers the non-obvious foot-guns (schema factory pattern, migration workflow, cron loop, WG fetch and rate limits).

## License

[AGPL v3](./LICENSE). Copyright (C) 2026 Antoine Kingue.

Not affiliated with Wargaming.net.
