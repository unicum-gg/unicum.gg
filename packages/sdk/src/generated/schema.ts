export interface paths {
    "/{region}/players/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search players
         * @description Search players by nickname prefix (minimum 3 characters). Returns the combined result set in a single JSON response: our database hits first, then Wargaming API hits (deduped). Waits for the (rate-limited) Wargaming call, so it can be slower than the streamed variant. For progressive results, use `/search/ndjson`.
         */
        get: operations["get-{region}-players-search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/search/ndjson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search players (streamed)
         * @description Search players by nickname prefix (minimum 3 characters). Streams NDJSON (one JSON object per line): a `local` chunk from our database first (instant), then a `remote` chunk from the Wargaming API (deduped against local) as it arrives. For a single combined JSON response, use `/search`.
         */
        get: operations["get-{region}-players-search-ndjson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/top": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Top players
         * @description Player leaderboard for a region.
         */
        get: operations["get-{region}-players-top"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Compare players
         * @description Inputs for a side-by-side comparison of up to 4 players (`?names=a,b,c`): each player's tracked row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and the WN8/WNX expected-value tables the ratings derive from. Dates are ISO 8601 strings.
         */
        get: operations["get-{region}-players-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/languages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player languages
         * @description Languages the region's tracked players speak (inferred from their clan's declared languages), with total and strict (single-language clans) counts. Backs the by-language leaderboards.
         */
        get: operations["get-{region}-players-languages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/{nickname}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player detail
         * @description Full player detail for a region: profile, random-battles totals with 24h/7d/30d period diffs, derived per-tank-breakdown stats (average tier, assistance damages, WN7/WN8/WNX), the tank-by-tank table with all three ratings, the tanks lifting or dragging the overall rating, rating history, clan history, and every non-random game mode's totals. Works for ANY player: cached data is served immediately; on a cold cache the account is resolved on Wargaming, fetched live and recorded (which also starts tracking it). 403 with error "account_locked" when the account exists but Wargaming has locked it (no stats available), 404 only when Wargaming doesn't know the nickname either. Dates are ISO 8601 strings.
         */
        get: operations["get-{region}-players-{nickname}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/{nickname}/clan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player current clan
         * @description The player's current clan (tag, name, color) from cached data only, with no live Wargaming call. Returns `{ clan: null }` when the player is not in a clan or is not yet tracked. A lightweight companion to the full player detail, meant for compact UI such as nav bars.
         */
        get: operations["get-{region}-players-{nickname}-clan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/{nickname}/tanks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player tanks
         * @description Per-tank rows for a player: the tank-by-tank breakdown with per-battle averages and WN7/WN8/WNX ratings. This is the heavy list on the player page, so it lives on its own endpoint and is loaded on demand (a deep link to `?section=tanks` server-renders it; otherwise the client fetches it when the Tanks section is first opened). 404 when the player is unknown.
         */
        get: operations["get-{region}-players-{nickname}-tanks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/{nickname}/enqueue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enqueue player refresh
         * @description Signals that a real browser is viewing this player's page. Schedules a background refresh of the player's stats from the Wargaming API. Idempotent: calling it multiple times only raises the existing queue entry's priority, never duplicates work.
         */
        post: operations["post-{region}-players-{nickname}-enqueue"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/{nickname}/sse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player live stream
         * @description Server-sent events (SSE) for live player profile updates.
         */
        get: operations["get-{region}-players-{nickname}-sse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search clans
         * @description Search clans by name or tag prefix (minimum 3 characters). Returns the combined result set in a single JSON response: our database hits first, then Wargaming API hits (deduped). Waits for the (rate-limited) Wargaming call, so it can be slower than the streamed variant. For progressive results, use `/search/ndjson`.
         */
        get: operations["get-{region}-clans-search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/search/ndjson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search clans (streamed)
         * @description Search clans by name or tag prefix (minimum 3 characters). Streams NDJSON (one JSON object per line): a `local` chunk from our database first (instant), then a `remote` chunk from the Wargaming API (deduped against local) as it arrives. For a single combined JSON response, use `/search`.
         */
        get: operations["get-{region}-clans-search-ndjson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/stronghold/top": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stronghold clan leaderboard
         * @description The region's best stronghold clans for one mode/tier (Advances, tier X/VIII/VI skirmishes), ranked by SR (skirmish rating), Elo, battles, or win rate, over all-time or the last 30 days. Top 100; cached ~10 min server-side.
         */
        get: operations["get-{region}-clans-stronghold-top"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/top": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Top clans
         * @description Clan leaderboard for a region.
         */
        get: operations["get-{region}-clans-top"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Compare clans
         * @description Inputs for a side-by-side comparison of up to 4 clans (`?tags=a,b,c`): each clan's profile, rated members and per-tank aggregates, plus the vehicle catalogue and the WN8/WNX expected-value tables. Dates are ISO 8601 strings.
         */
        get: operations["get-{region}-clans-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/languages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan languages
         * @description Languages the region's clans declare, with total and strict (single-language) counts. Backs the by-language leaderboards.
         */
        get: operations["get-{region}-clans-languages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan overview
         * @description The clan's profile and its battle-weighted aggregate ratings (lifetime and 30-day WN7/WN8/WNX plus the average win rate). The heavy per-category data lives on the dedicated sub-endpoints: `/members`, `/previous-clans`, `/activity`, `/stronghold`, `/clan-wars` and `/vehicles`. 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan members
         * @description The clan's members with cached WN7/WN8/WNX ratings (overall and 30-day) and per-period aggregate stats. 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}-members"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/previous-clans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan previous clans
         * @description The clans the current members previously belonged to, with how many came from each. 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}-previous-clans"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan activity
         * @description Recent join / leave / role-change events for the clan. 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}-activity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/stronghold": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan stronghold stats
         * @description The clan's Stronghold Elo and skirmish/advances stats per tier: `latest` is the current snapshot; each entry in `periods` is the change vs the snapshot 24h/7d/30d ago (null when there's no comparison point). 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}-stronghold"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/clan-wars": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan wars stats
         * @description The clan's Global Map (Clan Wars) Elo, battles, wins and provinces per tier: `latest` is the current snapshot; each entry in `periods` is the change vs the snapshot 24h/7d/30d ago (null when there's no comparison point). 404 if the region's clan with this tag doesn't exist.
         */
        get: operations["get-{region}-clans-{tag}-clan-wars"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/vehicles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan vehicles
         * @description Per-tank stats for a clan, aggregated across all members from their most recent tank snapshots: member count, total battles, battle-weighted average damage and XP, win rate, and WN7/WN8/WNX ratings. This is the heavy aggregation on the clan page, so it lives on its own endpoint and is loaded on demand.
         */
        get: operations["get-{region}-clans-{tag}-vehicles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/enqueue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enqueue clan refresh
         * @description Signals that a real browser is viewing this clan's page. Schedules a background refresh of the clan's data from the Wargaming API. Idempotent: calling it multiple times only raises the existing queue entry's priority, never duplicates work.
         */
        post: operations["post-{region}-clans-{tag}-enqueue"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/clans/{tag}/sse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan live stream
         * @description Server-sent events (SSE) for live clan profile updates.
         */
        get: operations["get-{region}-clans-{tag}-sse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search tanks
         * @description Search the vehicle catalogue by name, short name or tag (minimum 3 characters), served from our in-memory catalogue. Returns the results in a single JSON response. For the streamed variant (a single `local` chunk), use `/search/ndjson`.
         */
        get: operations["get-{region}-tanks-search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/search/ndjson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search tanks (streamed)
         * @description Search the vehicle catalogue by name, short name or tag (minimum 3 characters). Streams NDJSON with a single `local` chunk served from our in-memory catalogue. For a plain JSON response, use `/search`.
         */
        get: operations["get-{region}-tanks-search-ndjson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks performance
         * @description Server-wide performance for every tank on a region, averaged over tracked players: win rate, average damage, WN7/WN8/WNX, kills-per-death, assistance, spots, hit and penetration rate, blocked damage and survival, plus Marks of Excellence / Mastery holder counts. One row per vehicle in the region's catalogue; `stats` is null until the by-tank cron has coverage.
         */
        get: operations["get-{region}-tanks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/specifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks specifications
         * @description Combat specifications for every tank on a region: firepower (damage, DPM, penetration, accuracy, aim time), gun handling and dispersion, mobility (speed, traverse, terrain resistance, power-to-weight), survivability (hit points, armor, module health) and concealment / view range. One row per vehicle in the region's catalogue. Values are region-agnostic (WG balances vehicles identically across servers); only the catalogue differs per region.
         */
        get: operations["get-{region}-tanks-specifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/economics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks economics
         * @description Economics for every tank on a region: purchase price in credits and gold, shell and ammunition cost, the research XP to unlock it from its direct parent, and the total free XP to reach it from a tier 1. One row per vehicle in the region's catalogue. Values are region-agnostic; only the catalogue differs per region.
         */
        get: operations["get-{region}-tanks-economics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/marks-of-excellence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks Marks of Excellence
         * @description The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on every tank of a region, mirrored per region (marks differ per server). One row per vehicle in the region's catalogue; `moe` is null until the MoE cron has data for the vehicle.
         */
        get: operations["get-{region}-tanks-marks-of-excellence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/marks-of-mastery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks Marks of Mastery
         * @description The XP thresholds for the 3rd Class, 2nd Class, 1st Class and Ace Tanker Mastery badges on every tank of a region, mirrored per region (thresholds differ per server). One row per vehicle in the region's catalogue; `mastery` is null until the mastery cron has data for the vehicle.
         */
        get: operations["get-{region}-tanks-marks-of-mastery"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank performance
         * @description Server-wide performance for one tank on a region, averaged over tracked players (win rate, average damage, WN7/WN8/WNX, and more), plus Marks of Excellence / Mastery holder counts. 404 if the region's catalogue has no vehicle with this slug.
         */
        get: operations["get-{region}-tanks-{slug}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/detail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank detail
         * @description Everything the tank page renders in one payload: identity, top players per rating metric (WN7/WN8/WNX), server-average performance, WN8/WNX expected values, combat specifications, current Marks of Excellence/Mastery with their daily history, and the cheapest research path. `slug` in the response is the canonical slug; callers that reached the tank through a legacy numeric id should redirect to it. Dates are ISO 8601 strings.
         */
        get: operations["get-{region}-tanks-{slug}-detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/specifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank specifications
         * @description Combat specifications for one tank on a region: firepower, gun handling, mobility, survivability, concealment and recon. 404 if the region's catalogue has no vehicle with this slug.
         */
        get: operations["get-{region}-tanks-{slug}-specifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/economics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank economics
         * @description Economics for one tank on a region: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1. 404 if the region's catalogue has no vehicle with this slug.
         */
        get: operations["get-{region}-tanks-{slug}-economics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/marks-of-excellence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank Marks of Excellence
         * @description The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on one tank of a region (mirrored per region). 404 if the region's catalogue has no vehicle with this slug.
         */
        get: operations["get-{region}-tanks-{slug}-marks-of-excellence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/marks-of-mastery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank Marks of Mastery
         * @description The XP thresholds for the 3rd/2nd/1st Class and Ace Tanker Mastery badges on one tank of a region (mirrored per region). 404 if the region's catalogue has no vehicle with this slug.
         */
        get: operations["get-{region}-tanks-{slug}-marks-of-mastery"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/streamers/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Live streamers
         * @description Tracked players currently live on Twitch, across all regions, with their WN7/WN8/WNX ratings. Snapshot form of the `/streamers/live/sse` stream; cached ~30s server-side.
         */
        get: operations["get-streamers-live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/streamers/live/sse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Live streamers stream
         * @description Server-sent events (SSE) of the tracked players currently live on Twitch in the World of Tanks category across all regions, ranked by WNX and pushed every few seconds. Each event's `data` is the same JSON array as `GET /api/streamers/live`.
         */
        get: operations["get-streamers-live-sse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/server/online/sse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Players online stream
         * @description Server-sent events (SSE) of the region's live player count. Each event's data is a JSON object with the region total and the per-server breakdown, pushed whenever the count refreshes (about every 3 seconds).
         */
        get: operations["get-{region}-server-online-sse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/coverage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Coverage
         * @description How much of the region the tracker covers: player/clan/snapshot counts, refresh-policy health (per activity bucket), 30-day discovery and snapshot trends, and infrastructure size/cost. Cached for 60s server-side. Dates are ISO 8601 strings.
         */
        get: operations["get-{region}-coverage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health check
         * @description Liveness probe. Referenced as the `status` link relation in the
         */
        get: operations["get-health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/funding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Funding progress
         * @description Compact cumulative funding progress: how much of the total infrastructure spend since launch supporters have covered. Returns the percentage plus the raised and goal amounts in USD (aggregate only). Powers the top-bar mini funding bar.
         */
        get: operations["get-support-funding"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/podium": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Supporters podium
         * @description Active supporters ranked by their current monthly pledge, highest first. The pledge amount is never exposed, only the ranking; anonymous supporters appear as "Anonymous".
         */
        get: operations["get-support-podium"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mcp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * MCP endpoint
         * @description Model Context Protocol (MCP) server over a stateless Streamable HTTP transport. Point an MCP client at this URL to use unicum.gg's read API as MCP tools (the same player, clan and tank data as the REST endpoints). The POST body is a JSON-RPC 2.0 message (`initialize`, `tools/list`, `tools/call`, ...); the server replies with a JSON-RPC response or, when streaming, an SSE stream. `GET` opens the SSE stream and `DELETE` ends a session (transport-level, not documented separately).
         */
        post: operations["post-mcp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Generic OG card
         * @description A generic 1200×630 PNG social card with a customizable title and subtitle, used as the link-unfurl image for pages without a dedicated per-entity card.
         */
        get: operations["get-og"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og/{region}/clans/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clans comparison OG card
         * @description A side-by-side comparison card (up to 4 clans, WNX each) as a 1200×630 PNG.
         */
        get: operations["get-og-{region}-clans-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og/{region}/players/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Players comparison OG card
         * @description A side-by-side comparison card (up to 4 players, WNX each) as a 1200×630 PNG.
         */
        get: operations["get-og-{region}-players-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og/{region}/clans/{tag}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan OG card
         * @description The clan's stats card as a stable, hash-free 1200×630 PNG (members, average WNX, 30-day WNX, win rate). Mirrors the page's link-unfurl image for embedding directly (Discord bot, social share), without the route-group hash Next appends to the file convention's URL.
         */
        get: operations["get-og-{region}-clans-{tag}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og/{region}/players/{nickname}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player OG card
         * @description The player's stats card as a stable, hash-free 1200×630 PNG (battles, WNX, 30-day WNX, win rate). Mirrors the page's link-unfurl image for embedding directly (Discord bot, social share), without the route-group hash Next appends to the file convention's URL.
         */
        get: operations["get-og-{region}-players-{nickname}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/og/{region}/tanks/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank OG card
         * @description The tank's stats card as a stable, hash-free 1200×630 PNG (tier, class, best player, top WNX, with the vehicle render). Mirrors the page's link-unfurl image for embedding directly (Discord bot, social share), without the route-group hash Next appends to the file convention's URL.
         */
        get: operations["get-og-{region}-tanks-{slug}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ClanActivityResponse: {
            events: components["schemas"]["ClanEvent"][];
        };
        clanCompareSlot: {
            /** @description The clan tag as requested. */
            requested: string;
            /** @description The clan's profile (null when unknown). */
            clan: string | null;
            /** @description Members with cached WN7/WN8/WNX ratings. */
            members: string[];
            /** @description Per-tank aggregates across the clan's members. */
            tankAggregates: string[];
        };
        /** @description A recent join, leave or role-change event. */
        ClanEvent: {
            type: string;
            /** Format: date-time */
            createdAt: Date;
            accountId: number;
            accountName: string;
            oldRole: string | null;
            newRole: string | null;
            oldRank: number | null;
            newRank: number | null;
        };
        /** @description A clan's Global Map (Clan Wars) Elo, battles and wins per tier (6/8/10) and its province count. */
        ClanGlobalMapStats: {
            gmEloT10: number | null;
            gmBattlesT10: number | null;
            gmWinsT10: number | null;
            gmEloT8: number | null;
            gmBattlesT8: number | null;
            gmWinsT8: number | null;
            gmEloT6: number | null;
            gmBattlesT6: number | null;
            gmWinsT6: number | null;
            gmProvinces: number | null;
        };
        /** @description Core clan profile. */
        ClanInfo: {
            id: number;
            tag: string;
            name: string;
            color: string;
            emblem: string;
            motto: string;
            descriptionHtml: string;
            /** Format: date-time */
            createdAt: Date;
            /** Format: date-time */
            updatedAt: Date | null;
            membersCount: number;
            leaderId: number;
            leaderName: string;
            creatorId: number;
            creatorName: string;
            isDisbanded: boolean;
            languages: string[];
        };
        ClanLanguagesResponse: {
            results: components["schemas"]["clanLanguageStat"][];
        };
        clanLanguageStat: {
            /** @description Two-letter language code. */
            code: string;
            total: number;
            strict: number;
        };
        /** @description A clan member with cached WN7/WN8/WNX ratings. */
        ClanMember: {
            accountId: number;
            name: string;
            role: string;
            roleLocalized: string;
            roleRank: number;
            daysInClan: number;
            /** Format: date-time */
            lastBattleTime: Date | null;
            personalRating: number | null;
            overall: components["schemas"]["ClanMemberPeriodStats"] | null;
            d28: components["schemas"]["ClanMemberPeriodStats"] | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            wn730d: number | null;
            wn830d: number | null;
            wnx30d: number | null;
            battles30d: number | null;
            isVerified?: boolean;
            isSupporter?: boolean;
            twitchLogin?: string | null;
        };
        /** @description A member's aggregate stats over a period. */
        ClanMemberPeriodStats: {
            battles: number;
            winsPercentage: number;
            damagePerBattle: number;
            expPerBattle: number;
            fragsPerBattle: number;
            battlesPerDay: number;
        };
        ClanMembersResponse: {
            members: components["schemas"]["ClanMember"][];
        };
        ClanOverviewResponse: {
            clan: components["schemas"]["ClanInfo"];
            ratings: components["schemas"]["ClanRatings"];
            /** @description Previous tags + names of this clan, newest first. Empty until a rename is observed. */
            nameHistory: {
                tag: string;
                name: string;
                /** Format: date-time */
                recordedAt: Date;
            }[];
        };
        /**
         * @description Clan leaderboard time window.
         * @example overall
         * @enum {string}
         */
        clanPeriodField: "overall" | "30d";
        ClanPreviousClansResponse: {
            previousClans: components["schemas"]["PreviousClan"][];
        };
        /** @description The clan's battle-weighted aggregate ratings: lifetime and 30-day WN7/WN8/WNX (weighted by lifetime and recent battles), plus the lifetime average win rate. */
        ClanRatings: {
            lifetime: components["schemas"]["ratingTriplet"];
            recent: components["schemas"]["ratingTriplet"];
            avgWinrate: number | null;
        };
        /** @description Inputs for a side-by-side clan comparison: each clan's profile, rated members and per-tank aggregates, plus the vehicle catalogue and WN8/WNX expected-value tables. */
        ClansCompare: {
            slots: components["schemas"]["clanCompareSlot"][];
            encyclopedia: {
                [key: string]: string;
            };
            wn8Expected: {
                [key: string]: string;
            };
            wnxExpected: {
                [key: string]: string;
            };
            /** @description Precomputed WN8 fallback (per tier+type average) for fielded tanks missing from the expected table, keyed by `tier-type`. */
            wn8Fallback: {
                [key: string]: string;
            };
        };
        /** @description Inputs for a side-by-side clan comparison: each clan's profile, rated members and per-tank aggregates, plus the vehicle catalogue and WN8/WNX expected-value tables. */
        ClansCompareResponse: {
            slots: components["schemas"]["clanCompareSlot"][];
            encyclopedia: {
                [key: string]: string;
            };
            wn8Expected: {
                [key: string]: string;
            };
            wnxExpected: {
                [key: string]: string;
            };
            /** @description Precomputed WN8 fallback (per tier+type average) for fielded tanks missing from the expected table, keyed by `tier-type`. */
            wn8Fallback: {
                [key: string]: string;
            };
        };
        ClanSearchChunk: unknown;
        ClanSearchResponse: {
            results: components["schemas"]["ClanSummary"][];
        };
        /** @description A period of membership in one clan. */
        ClanStint: {
            clan: {
                id: number;
                tag: string;
                name: string;
                color: string;
                emblem: string;
                languages: string[];
            };
            /** Format: date-time */
            joinedAt: Date;
            /** Format: date-time */
            leftAt: Date | null;
            role: string;
            roleLocalized: string;
        };
        ClanStrongholdResponse: {
            latest: components["schemas"]["ClanStrongholdStats"] | null;
            periods: {
                h24: components["schemas"]["ClanStrongholdStats"] | null;
                d7: components["schemas"]["ClanStrongholdStats"] | null;
                d30: components["schemas"]["ClanStrongholdStats"] | null;
            };
            sr: {
                advances: number | null;
                t10: number | null;
                t8: number | null;
                t6: number | null;
            } | null;
        };
        /** @description A clan's Stronghold Elo and skirmish/advances battles and wins per tier (6/8/10). */
        ClanStrongholdStats: {
            eloT6: number | null;
            skirmishBattlesT6: number | null;
            skirmishWinsT6: number | null;
            eloT8: number | null;
            skirmishBattlesT8: number | null;
            skirmishWinsT8: number | null;
            eloT10: number | null;
            skirmishBattlesT10: number | null;
            skirmishWinsT10: number | null;
            advancesBattlesT10: number | null;
            advancesWinsT10: number | null;
        };
        /** @description Clan row (additional fields may be present). */
        ClanSummary: {
            clan_id: number;
            tag: string;
            name: string;
        };
        /** @description A tank the clan has played, with battle-weighted averages and WN7/WN8/WNX ratings across all members. */
        ClanVehicle: {
            tankId: number;
            name: string;
            shortName: string | null;
            tier: number | null;
            nation: string | null;
            type: string | null;
            isPremium: boolean;
            memberCount: number;
            battles: number;
            avgDamage: number | null;
            avgXp: number | null;
            winrate: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
        };
        ClanVehiclesResponse: {
            vehicles: components["schemas"]["ClanVehicle"][];
        };
        ClanWarsResponse: {
            latest: components["schemas"]["ClanGlobalMapStats"] | null;
            periods: {
                h24: components["schemas"]["ClanGlobalMapStats"] | null;
                d7: components["schemas"]["ClanGlobalMapStats"] | null;
                d30: components["schemas"]["ClanGlobalMapStats"] | null;
            };
        };
        compareSlot: {
            /** @description The nickname as requested. */
            requested: string;
            /** @description The tracked player row (null when unknown to the tracker). */
            player: string | null;
            /** @description The player's latest snapshot (null when never snapped). */
            latest: string | null;
            /** @description Raw per-tank stats (WN8/WNX inputs). */
            tanks: string[];
        };
        /** @description Tracker coverage for one region: row counts, refresh-policy health, 30-day discovery/snapshot trends and infrastructure size/cost. */
        Coverage: {
            /** @enum {string} */
            region: "eu" | "na" | "asia";
            players: number;
            clans: number;
            playerSnapshots: number;
            tankSnapshots: number;
            clanMembers: number;
            clanRecentEvents: number;
            clanRefreshQueue: number;
            playerRefreshQueue: number;
            snapshotBacklog: number;
            activity: {
                /** Format: date-time */
                lastPlayerSnapshotAt: Date | null;
                /** Format: date-time */
                lastClanRefreshAt: Date | null;
                playerSnapshotsLast24h: number;
                clansRefreshedLast24h: number;
                snapshotFreshness: {
                    onTime: number;
                    fetched: number;
                };
                awaitingFirstSnapshot: number;
            };
            refreshPolicy: components["schemas"]["refreshPolicyBucket"][];
            funFacts: {
                /** Format: date-time */
                oldestPlayerSnapshotAt: Date | null;
                biggestClan: {
                    tag: string;
                    name: string;
                    membersCount: number;
                } | null;
                totalBattlesTracked: number;
            };
            trends: {
                playersDiscoveredDaily: components["schemas"]["dailyPoint"][];
                clansDiscoveredDaily: components["schemas"]["dailyPoint"][];
                playerSnapshotsDaily: components["schemas"]["dailyPoint"][];
                firstSnapshotsDaily: components["schemas"]["dailyPoint"][];
            };
            infrastructure: {
                databaseBytes: number;
                tables: {
                    name: string;
                    bytes: number;
                }[];
                costs: {
                    breakdown: {
                        label: string;
                        usdAnnual: number;
                        note?: string;
                    }[];
                    totalAnnualUsd: number;
                };
            };
        };
        /** @description Tracker coverage for one region: row counts, refresh-policy health, 30-day discovery/snapshot trends and infrastructure size/cost. */
        CoverageResponse: {
            /** @enum {string} */
            region: "eu" | "na" | "asia";
            players: number;
            clans: number;
            playerSnapshots: number;
            tankSnapshots: number;
            clanMembers: number;
            clanRecentEvents: number;
            clanRefreshQueue: number;
            playerRefreshQueue: number;
            snapshotBacklog: number;
            activity: {
                /** Format: date-time */
                lastPlayerSnapshotAt: Date | null;
                /** Format: date-time */
                lastClanRefreshAt: Date | null;
                playerSnapshotsLast24h: number;
                clansRefreshedLast24h: number;
                snapshotFreshness: {
                    onTime: number;
                    fetched: number;
                };
                awaitingFirstSnapshot: number;
            };
            refreshPolicy: components["schemas"]["refreshPolicyBucket"][];
            funFacts: {
                /** Format: date-time */
                oldestPlayerSnapshotAt: Date | null;
                biggestClan: {
                    tag: string;
                    name: string;
                    membersCount: number;
                } | null;
                totalBattlesTracked: number;
            };
            trends: {
                playersDiscoveredDaily: components["schemas"]["dailyPoint"][];
                clansDiscoveredDaily: components["schemas"]["dailyPoint"][];
                playerSnapshotsDaily: components["schemas"]["dailyPoint"][];
                firstSnapshotsDaily: components["schemas"]["dailyPoint"][];
            };
            infrastructure: {
                databaseBytes: number;
                tables: {
                    name: string;
                    bytes: number;
                }[];
                costs: {
                    breakdown: {
                        label: string;
                        usdAnnual: number;
                        note?: string;
                    }[];
                    totalAnnualUsd: number;
                };
            };
        };
        crewMember: {
            memberId: string;
            roles: string[];
            /** @description The member's WG tankopedia nation portrait, by slot position. */
            image: string | null;
            /** @description The role badge overlaid on the portrait (its primary role). */
            roleBadge: string | null;
            /** @description Skill keys this member can learn (its roles' + universal). */
            skills: string[];
        };
        crewSkill: {
            key: string;
            name: string;
            image: string | null;
            description: string;
            isPerk: boolean;
            /** @description Owning role (commander, gunner, ...) or 'common' (universal). */
            role: string;
            /** @description Passive per-skill-level effects on a displayed characteristic; empty for situational or non-spec skills (still shown, no delta). */
            effects: {
                attribute: string;
                value: number;
            }[];
            /** @description Crew-training-level bonus in level points (Brothers in Arms = 5), 0 for a normal skill; applied to every crew-affected stat, not a single one. */
            crewLevel: number;
            /** @description The Camouflage skill: scales the camo values by 0.57 + 0.43 * level, applied to camo rather than a single characteristic. */
            camouflage: boolean;
        };
        dailyPoint: {
            /** @description UTC day, YYYY-MM-DD. */
            day: string;
            count: number;
        };
        equipmentEffect: {
            attribute: string;
            /** @enum {string} */
            type: "mul" | "add";
            base: number;
            /** @description Value applied when the slot's category matches (Equipment 2.0). */
            bonus: number;
        };
        equipmentSlot: {
            /** @description The slot's category (null for a legacy universal slot). */
            category: string | null;
            /** @description True for the swappable role slot. */
            role: boolean;
            roleOptions?: string[];
        };
        fieldModItem: {
            key: string;
            name: string;
            image: string | null;
            effects: {
                attribute: string;
                /** @enum {string} */
                type: "mul" | "add";
                value: number;
            }[];
        };
        fieldModStep: {
            level: number;
            /** @enum {string} */
            kind: "feature" | "modification" | "pair";
            feature: {
                key: string;
                name: string;
                description: string | null;
                image: string | null;
            } | null;
            modification: components["schemas"]["fieldModItem"] | null;
            pair: {
                key: string;
                first: components["schemas"]["fieldModItem"];
                second: components["schemas"]["fieldModItem"];
            } | null;
        };
        /** @description Compact funding progress for the top-bar bar: how much of what has been spent since launch the community has covered. Amounts are aggregate only. */
        FundingSummary: {
            /** @description Share of the cumulative infrastructure spend since launch that supporters have covered, 0-100. */
            pct: number;
            /** @description Total received from supporters since launch, in USD. */
            receivedUsd: number;
            /** @description Cumulative infrastructure spend since launch, in USD. */
            goalUsd: number;
        };
        /** @description Compact funding progress for the top-bar bar: how much of what has been spent since launch the community has covered. Amounts are aggregate only. */
        FundingSummaryResponse: {
            /** @description Share of the cumulative infrastructure spend since launch that supporters have covered, 0-100. */
            pct: number;
            /** @description Total received from supporters since launch, in USD. */
            receivedUsd: number;
            /** @description Cumulative infrastructure spend since launch, in USD. */
            goalUsd: number;
        };
        HealthResponse: {
            /** @example ok */
            status: string;
        };
        /** @description Two-letter language code. When set, the leaderboard is filtered to players/clans whose clan declares this language (period is ignored: language boards are lifetime WNX). */
        languageField: string;
        /** @description One language's population. */
        LanguageStat: {
            /** @description Two-letter language code. */
            code: string;
            /** @description Players/clans with this language among their declared ones. */
            total: number;
            /** @description Players/clans whose clan declares only this language. */
            strict: number;
        };
        liftDragByMetricEntry: {
            lift: components["schemas"]["LiftDragRow"][];
            drag: components["schemas"]["LiftDragRow"][];
        } | null;
        /** @description A tank whose removal would move the overall rating by removalDelta (negative = it lifts the rating, positive = it drags it). */
        LiftDragRow: {
            tankId: number;
            name: string;
            tag: string;
            type: string;
            tier: number;
            isPremium: boolean;
            battles: number;
            rating: number;
            removalDelta: number;
        };
        /** @description A tracked player currently live on Twitch, with ratings. */
        LiveStreamer: {
            /** @enum {string} */
            region: "eu" | "na" | "asia";
            accountId: number;
            nickname: string;
            clanTag: string | null;
            clanColor: string | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            wn730d: number | null;
            wn830d: number | null;
            wnx30d: number | null;
            twitchLogin: string;
            twitchUserName: string;
            title: string;
            viewerCount: number;
            /** @description Stream start, ISO 8601. */
            startedAt: string;
            /** @description Stream language, ISO 639-1. */
            language: string;
            thumbnailUrl: string;
        };
        LiveStreamersResponse: {
            results: components["schemas"]["LiveStreamer"][];
        };
        loadoutConsumable: {
            key: string;
            name: string;
            /** @description The consumable's in-game description, from the client localization. */
            description: string;
            image: string | null;
            /** @description Passive multiplicative effects on a characteristic (fuel, extinguisher, ...); empty for repair/first-aid kits and crew rations. */
            effects: {
                attribute: string;
                value: number;
            }[];
        };
        loadoutDirective: {
            key: string;
            /** @description The equipment family (its `icon`) an equipment directive enhances; empty for crew directives. Any mounted device of that family enables it. */
            equipmentIcon: string;
            name: string;
            /** @description The directive's in-game description, from the client localization. */
            description: string;
            image: string | null;
            attribute: string;
            /** @enum {string} */
            type: "mul" | "add";
            value: number;
            /** @description A crew directive (boosts a crew skill, always mountable) rather than an equipment directive. */
            crew: boolean;
            /**
             * @description Crew directives: scales the boosted skill's effective level or its efficiency.
             * @enum {string|null}
             */
            boostKind: "level" | "efficiency" | null;
            boostValue: number;
            /** @description The boosted skill's per-level spec effects. */
            effects: {
                attribute: string;
                value: number;
            }[];
            camouflage: boolean;
            commander: boolean;
        };
        loadoutEquipment: {
            key: string;
            name: string;
            /** @description The device's in-game description, from the client localization. */
            description: string;
            image: string | null;
            /**
             * @description Acquisition grade: standard (credits), bond (improved), bounty, bountyUpgraded or experimental.
             * @enum {string}
             */
            grade: "standard" | "bond" | "bounty" | "bountyUpgraded" | "experimental";
            /** @description wot-src family icon; the directive/equipment family key. */
            icon: string;
            /** @description Equipment 2.0 categories (firepower, mobility, survivability, stealth). */
            categories: string[];
            effects: components["schemas"]["equipmentEffect"][];
        };
        /** @description A JSON-RPC 2.0 response from the MCP endpoint (carries a method-specific `result` or a JSON-RPC `error`). */
        McpResponse: {
            jsonrpc: string;
            id: (string | number) | null;
        };
        moduleShell: {
            type: string;
            damage: number;
            penetration: number;
        };
        moduleStats: {
            /** @enum {string} */
            kind: "gun";
            reloadTime: number;
            fireRate: number;
            aimTime: number;
            dispersion: number;
            maxAmmo: number;
            moveDownArc: number;
            moveUpArc: number;
            traverseSpeed: number;
            shells: components["schemas"]["moduleShell"][];
        } | {
            /** @enum {string} */
            kind: "turret";
            armorFront: number;
            armorSides: number;
            armorRear: number;
            hp: number;
            viewRange: number;
            traverseSpeed: number;
        } | {
            /** @enum {string} */
            kind: "engine";
            power: number;
            fireChance: number;
        } | {
            /** @enum {string} */
            kind: "chassis";
            loadLimit: number;
            traverseSpeed: number;
        } | {
            /** @enum {string} */
            kind: "radio";
            signalRange: number;
        };
        moduleTankRef: {
            tankId: number;
            slug: string;
            name: string;
            tier: number;
            type: string;
            tag: string;
        };
        /** @description A 1200×630 PNG stats card. */
        ogImageResponse: string;
        /** @description One derived value per column: lifetime, 24h, 7d, 30d. */
        PeriodValues: {
            total: number | null;
            h24: number | null;
            d7: number | null;
            d30: number | null;
        };
        /** @description A player's current clan, from cached data only (no live Wargaming call). `clan` is null when the player is not in a clan or is not yet cached. */
        PlayerClan: {
            clan: components["schemas"]["PlayerClanTag"] | null;
        };
        /** @description Current and past clan memberships. */
        PlayerClanHistory: {
            currentStint: components["schemas"]["ClanStint"] | null;
            pastStints: components["schemas"]["ClanStint"][];
            totalClans: number;
            timeInClansSeconds: number;
        };
        /** @description A player's current clan, from cached data only (no live Wargaming call). `clan` is null when the player is not in a clan or is not yet cached. */
        PlayerClanResponse: {
            clan: components["schemas"]["PlayerClanTag"] | null;
        };
        /** @description A player's current clan: tag, name and display color. */
        PlayerClanTag: {
            tag: string;
            name: string;
            /** @description Clan display color as a hex string. */
            color: string;
        };
        /** @description Per-tank-breakdown derivations: average tier, assistance damages and WN7/WN8/WNX per column. */
        PlayerDerivedStats: {
            tier: components["schemas"]["PeriodValues"];
            trackDamage: components["schemas"]["PeriodValues"];
            spottingDamage: components["schemas"]["PeriodValues"];
            assistingDamage: components["schemas"]["PeriodValues"];
            combinedDamage: components["schemas"]["PeriodValues"];
            wn7: components["schemas"]["PeriodValues"];
            wn8: components["schemas"]["PeriodValues"];
            wnx: components["schemas"]["PeriodValues"];
        };
        PlayerDetailResponse: {
            player: {
                accountId: number;
                nickname: string;
                /** Format: date-time */
                createdAt: Date;
                /** Format: date-time */
                lastBattleAt: Date;
                /** Format: date-time */
                updatedAt: Date;
            };
            /** @description Previous nicknames of this account, newest first. Empty until a rename is observed (WG exposes no historical names). */
            nameHistory: {
                nickname: string;
                /** Format: date-time */
                recordedAt: Date;
            }[];
            isSupporter: boolean;
            isVerified: boolean;
            twitchLogin: string | null;
            current: components["schemas"]["PlayerStats"];
            periods: {
                h24: components["schemas"]["PlayerStats"] | null;
                d7: components["schemas"]["PlayerStats"] | null;
                d30: components["schemas"]["PlayerStats"] | null;
            };
            derived: components["schemas"]["PlayerDerivedStats"];
            tankCount: number;
            /** @description Estimated account worth: market resale value (modelled from grey-market listings, driven mostly by the WG global rating and battle count, with the garage as a small floor) and the store rebuild cost. */
            valuation: {
                market: {
                    amount: number;
                    content: number;
                    tierX: number;
                    premiums: number;
                    rewards: number;
                    marks: number;
                    skillPremium: number;
                    depthBonus: number;
                    rewardCount: number;
                    tierXCount: number;
                    premiumCount: number;
                    mark3Count: number;
                    wgr: number;
                    battles: number;
                    rewardsByTier: components["schemas"]["tierContribution"][];
                    premiumsByTier: components["schemas"]["tierContribution"][];
                    marks3ByTier: components["schemas"]["tierContribution"][];
                    marks2ByTier: components["schemas"]["tierContribution"][];
                };
                account: {
                    amount: number;
                    currency: string;
                } | null;
            };
            liftDrag: {
                wn7: components["schemas"]["liftDragByMetricEntry"];
                wn8: components["schemas"]["liftDragByMetricEntry"];
                wnx: components["schemas"]["liftDragByMetricEntry"];
            };
            ratingHistory: components["schemas"]["RatingHistoryPoint"][];
            clanHistory: components["schemas"]["PlayerClanHistory"];
            strongholds: {
                skirmish: components["schemas"]["StrongholdMode"];
                fortified: components["schemas"]["StrongholdMode"];
                epic: components["schemas"]["StrongholdMode"];
                ranked: components["schemas"]["StrongholdMode"];
                fallout: components["schemas"]["StrongholdMode"];
                cwAbsolute: components["schemas"]["StrongholdMode"];
                cwChampion: components["schemas"]["StrongholdMode"];
                cwMiddle: components["schemas"]["StrongholdMode"];
            };
        };
        PlayerLanguagesResponse: {
            results: components["schemas"]["LanguageStat"][];
        };
        /** @description Inputs for a side-by-side player comparison: each player's row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and WN8/WNX expected-value tables. */
        PlayersCompare: {
            slots: components["schemas"]["compareSlot"][];
            /** @description Vehicle catalogue keyed by tank id. */
            encyclopedia: {
                [key: string]: string;
            };
            /** @description WN8 expected values keyed by tank id. */
            wn8Expected: {
                [key: string]: string;
            };
            /** @description WNX expected values keyed by tank id. */
            wnxExpected: {
                [key: string]: string;
            };
            /** @description Precomputed WN8 fallback (per tier+type average) for owned tanks missing from the expected table, keyed by `tier-type`. */
            wn8Fallback: {
                [key: string]: string;
            };
        };
        /** @description Inputs for a side-by-side player comparison: each player's row, latest snapshot and raw per-tank stats, plus the vehicle catalogue and WN8/WNX expected-value tables. */
        PlayersCompareResponse: {
            slots: components["schemas"]["compareSlot"][];
            /** @description Vehicle catalogue keyed by tank id. */
            encyclopedia: {
                [key: string]: string;
            };
            /** @description WN8 expected values keyed by tank id. */
            wn8Expected: {
                [key: string]: string;
            };
            /** @description WNX expected values keyed by tank id. */
            wnxExpected: {
                [key: string]: string;
            };
            /** @description Precomputed WN8 fallback (per tier+type average) for owned tanks missing from the expected table, keyed by `tier-type`. */
            wn8Fallback: {
                [key: string]: string;
            };
        };
        PlayerSearchChunk: unknown;
        /** @description A player search hit: account id, nickname and clan (if any). */
        PlayerSearchHit: {
            account_id: number;
            nickname: string;
            /** @description The player's clan tag and color, when tracked. */
            clan: {
                tag: string;
                color: string;
            } | null;
            is_verified?: boolean;
            is_supporter?: boolean;
            twitch_login?: string | null;
        };
        PlayerSearchResponse: {
            results: components["schemas"]["PlayerSearchHit"][];
        };
        /** @description Random-battles totals (or a period diff of them) from a snapshot. */
        PlayerStats: {
            battles: number;
            wins: number;
            losses: number;
            draws: number;
            survivedBattles: number;
            frags: number;
            damageDealt: number;
            xp: number;
            spotted: number;
            capturePoints: number;
            droppedCapturePoints: number;
            hits: number;
            shots: number;
            globalRating: number;
            wtr: number | null;
        };
        /** @description Player row (additional fields may be present). */
        PlayerSummary: {
            account_id: number;
            nickname: string;
            is_verified?: boolean;
            is_supporter?: boolean;
            twitch_login?: string | null;
        };
        PlayerTanksResponse: {
            tanks: components["schemas"]["PlayerVehicle"][];
        };
        /** @description A tank the player has battles in, with per-battle averages and WN7/WN8/WNX ratings. */
        PlayerVehicle: {
            tankId: number;
            name: string;
            shortName: string | null;
            tag: string | null;
            tier: number | null;
            nation: string | null;
            type: string | null;
            isPremium: boolean;
            mom: number | null;
            moe: number | null;
            battles: number;
            avgDamage: number | null;
            avgXp: number | null;
            winrate: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            buyGold: number | null;
            buyCredits: number | null;
            researchXp: number | null;
        };
        /** @description One supporter on the podium, ranked by current monthly pledge. The amount is never exposed. */
        PodiumSupporter: {
            rank: number;
            /** @description Supporter Wargaming nickname, or "Anonymous". */
            name: string;
            anonymous: boolean;
        };
        /** @description A clan that current members previously belonged to. */
        PreviousClan: {
            clanId: number;
            tag: string;
            name: string;
            color: string;
            emblem: string | null;
            languages: string[];
            totalCount: number;
            cameFromCount: number;
        };
        /** @description Daily rating sample: lifetime and per-session values, each carrying all three metrics (wn7/wn8/wnx) so the client can switch metric without a refetch. */
        RatingHistoryPoint: {
            day: string;
            lifetime: components["schemas"]["ratingMetricValues"];
            session: components["schemas"]["ratingMetricValues"];
        };
        ratingMetricValues: {
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
        };
        ratingTriplet: {
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
        };
        refreshPolicyBucket: {
            /** @enum {string} */
            bucket: "unfetched" | "hidden" | "active_24h" | "active_7d" | "recent_30d" | "recent_90d" | "dormant_1y" | "inactive";
            /** @description Target refresh cadence for this activity bucket, in ms. */
            cadenceMs: number;
            total: number;
            onTime: number;
            neverSnapped: number;
        };
        researchPathItem: {
            tankId: number;
            slug: string;
            meta: components["schemas"]["VehicleMeta"];
            researchXp: number | null;
            buyCredits: number | null;
        };
        skillNode: {
            id: number;
            /** @description Importance/size tier: common | major | final, or special (feature node). */
            type: string;
            /** @description firepower | mobility | survivability | mechanics; empty for feature nodes. */
            category: string;
            isFeature: boolean;
            name: string;
            description: string | null;
            image: string | null;
            effects: {
                attribute: string;
                /** @enum {string} */
                type: "mul" | "add";
                value: number;
            }[];
            /** @description The client's 2D layout coordinates (x, y). */
            position: [
                number,
                number
            ];
            /** @description Forward-edge node ids this node unlocks. */
            unlocks: number[];
            /** @description Reachable as soon as ANY predecessor is unlocked (else all). */
            unlockStrategyAny: boolean;
        };
        /**
         * @description With `language`: only count clans that declare exactly this one language.
         * @enum {string}
         */
        strictField: "true" | "false";
        /** @description One clan on the stronghold leaderboard. */
        StrongholdLeaderboardEntry: {
            clanId: number;
            tag: string;
            name: string;
            color: string;
            emblem: string;
            languages: string[];
            membersCount: number;
            /** @description Tier Elo (null for Advances, which has no Elo). */
            elo: number | null;
            /** @description Battles over the selected period. */
            battles: number;
            /** @description Wins over the selected period. */
            wins: number;
            /** @description Median WG Personal Rating (WGR) of the clan's roster. */
            personalRating: number | null;
            /** @description Share of the roster (0..1) that reads as boost accounts (few random battles). Higher discounts SR. */
            boostRatio: number | null;
            /** @description Composite skirmish rating: roster strength (median Personal Rating) weighted by win rate, battle volume and roster maturity over the selected period. */
            sr: number | null;
        };
        /** @description One game mode's totals plus 24h/7d/30d period diffs. */
        StrongholdMode: {
            current: components["schemas"]["StrongholdStats"] | null;
            periods: {
                h24: components["schemas"]["StrongholdStats"] | null;
                d7: components["schemas"]["StrongholdStats"] | null;
                d30: components["schemas"]["StrongholdStats"] | null;
            };
        };
        /** @description Totals for one non-random game mode. */
        StrongholdStats: {
            battles: number;
            wins: number;
            losses: number;
            draws: number;
            survivedBattles: number;
            frags: number;
            damageDealt: number;
            spotted: number;
            capturePoints: number;
            droppedCapturePoints: number;
            battleAvgXp: number;
        };
        StrongholdTopResponse: {
            results: components["schemas"]["StrongholdLeaderboardEntry"][];
        };
        /** @description Active supporters ranked by current monthly pledge, highest first. Individual amounts are never exposed; anonymous supporters appear as "Anonymous". */
        SupportersPodium: {
            supporters: components["schemas"]["PodiumSupporter"][];
            /** @description Total monthly pledge across all active supporters, in EUR cents (aggregate only, for the funding bar). */
            monthlyPledgedCents: number;
            /** @description Total amount received from supporters since launch, in EUR cents (aggregate only, for the cumulative funding bar). */
            receivedCents: number;
        };
        /** @description Active supporters ranked by current monthly pledge, highest first. Individual amounts are never exposed; anonymous supporters appear as "Anonymous". */
        SupportersPodiumResponse: {
            supporters: components["schemas"]["PodiumSupporter"][];
            /** @description Total monthly pledge across all active supporters, in EUR cents (aggregate only, for the funding bar). */
            monthlyPledgedCents: number;
            /** @description Total amount received from supporters since launch, in EUR cents (aggregate only, for the cumulative funding bar). */
            receivedCents: number;
        };
        tankConfig: {
            /** @description The WG module ids mounted in this configuration, one per slot (null when the tank has no module of that class). */
            modules: {
                gun: number | null;
                turret: number | null;
                engine: number | null;
                chassis: number | null;
                radio: number | null;
            };
            /** @description The full combat specification for this module combination, same shape as the top-level `specs` row. */
            specs: string;
        };
        tankCrew: {
            members: components["schemas"]["crewMember"][];
            skills: components["schemas"]["crewSkill"][];
        };
        /** @description Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path. */
        TankDetail: {
            tankId: number;
            /** @description Canonical slug. Callers that reached the tank through a legacy id or wrong-case slug should redirect to it. */
            slug: string;
            meta: components["schemas"]["VehicleMeta"];
            topByMetric: {
                wn7: components["schemas"]["topTankPlayer"][];
                wn8: components["schemas"]["topTankPlayer"][];
                wnx: components["schemas"]["topTankPlayer"][];
                /** Format: date-time */
                computedAt: Date | null;
            };
            serverStats: components["schemas"]["TankServerStats"] | null;
            wn8Expected: {
                expDamage: number;
                expSpot: number;
                expFrag: number;
                expDef: number;
                expWinRate: number;
            } | null;
            wnxExpected: {
                damage: number;
                frags: number;
                spots: number;
                assist: number;
            } | null;
            specs: string | null;
            moe: {
                mark1: number;
                mark2: number;
                mark3: number;
            } | null;
            mom: {
                class3: number;
                class2: number;
                class1: number;
                ace: number;
            } | null;
            researchPath: {
                lineage: components["schemas"]["researchPathItem"][];
                next: components["schemas"]["researchPathItem"][];
            } | null;
            /** @description The module research DAG (nodes with unlock edges), in-game row order (gun, turret, engine, suspension, radio) then XP cost. Empty for tanks WG's Tankopedia doesn't detail. */
            modules: components["schemas"]["tankModuleNode"][];
            /** @description Every selectable module combination with its full derived specs, so the page re-renders the characteristics from the modules the user picks. Empty when the wot-src catalogue has nothing for the tank (the page shows the static stock specs). */
            configs: components["schemas"]["tankConfig"][];
            /** @description The tank's Equipment 2.0 slots and every compatible device (with effects), so the page can apply equipment to the characteristics. Null when the wot-src catalogue has nothing for the tank. */
            loadout: components["schemas"]["tankLoadout"] | null;
            /** @description The tank's crew composition and the crew-skill catalogue (name, icon, role, per-level spec effects), so the page can apply crew skills to the characteristics. Null when WG has no crew for the vehicle. */
            crew: components["schemas"]["tankCrew"] | null;
            /** @description The tank's field modifications (post progression): the level steps with their stat effects and dual-modification choices. Null below tier VI or when the wot-src catalogue has nothing for the tank. */
            fieldMods: components["schemas"]["tankFieldMods"] | null;
            /** @description The tank's vehicle skill tree (the tier-XI 'upgrades'): the node graph with each node's stat effects and 2D layout. Null for every tier <= X vehicle (which uses field modifications instead). */
            skillTree: components["schemas"]["tankSkillTree"] | null;
            /** @description The alternate driving modes the vehicle can switch into (siege for Swedish TDs, rapid for wheeled vehicles), each as ratio factors over the base spec plus any gun-arc override. Empty for the vast majority of vehicles, which have no mode. */
            modes: components["schemas"]["vehicleMode"][];
            moeHistory: {
                day: string;
                mark1: number;
                mark2: number;
                mark3: number;
            }[];
            momHistory: {
                day: string;
                class3: number;
                class2: number;
                class1: number;
                ace: number;
            }[];
        };
        /** @description Everything the tank page renders: identity, best players per rating metric, server averages, WN8/WNX expected values, combat specs, Marks of Excellence/Mastery (current and history) and the research path. */
        TankDetailResponse: {
            tankId: number;
            /** @description Canonical slug. Callers that reached the tank through a legacy id or wrong-case slug should redirect to it. */
            slug: string;
            meta: components["schemas"]["VehicleMeta"];
            topByMetric: {
                wn7: components["schemas"]["topTankPlayer"][];
                wn8: components["schemas"]["topTankPlayer"][];
                wnx: components["schemas"]["topTankPlayer"][];
                /** Format: date-time */
                computedAt: Date | null;
            };
            serverStats: components["schemas"]["TankServerStats"] | null;
            wn8Expected: {
                expDamage: number;
                expSpot: number;
                expFrag: number;
                expDef: number;
                expWinRate: number;
            } | null;
            wnxExpected: {
                damage: number;
                frags: number;
                spots: number;
                assist: number;
            } | null;
            specs: string | null;
            moe: {
                mark1: number;
                mark2: number;
                mark3: number;
            } | null;
            mom: {
                class3: number;
                class2: number;
                class1: number;
                ace: number;
            } | null;
            researchPath: {
                lineage: components["schemas"]["researchPathItem"][];
                next: components["schemas"]["researchPathItem"][];
            } | null;
            /** @description The module research DAG (nodes with unlock edges), in-game row order (gun, turret, engine, suspension, radio) then XP cost. Empty for tanks WG's Tankopedia doesn't detail. */
            modules: components["schemas"]["tankModuleNode"][];
            /** @description Every selectable module combination with its full derived specs, so the page re-renders the characteristics from the modules the user picks. Empty when the wot-src catalogue has nothing for the tank (the page shows the static stock specs). */
            configs: components["schemas"]["tankConfig"][];
            /** @description The tank's Equipment 2.0 slots and every compatible device (with effects), so the page can apply equipment to the characteristics. Null when the wot-src catalogue has nothing for the tank. */
            loadout: components["schemas"]["tankLoadout"] | null;
            /** @description The tank's crew composition and the crew-skill catalogue (name, icon, role, per-level spec effects), so the page can apply crew skills to the characteristics. Null when WG has no crew for the vehicle. */
            crew: components["schemas"]["tankCrew"] | null;
            /** @description The tank's field modifications (post progression): the level steps with their stat effects and dual-modification choices. Null below tier VI or when the wot-src catalogue has nothing for the tank. */
            fieldMods: components["schemas"]["tankFieldMods"] | null;
            /** @description The tank's vehicle skill tree (the tier-XI 'upgrades'): the node graph with each node's stat effects and 2D layout. Null for every tier <= X vehicle (which uses field modifications instead). */
            skillTree: components["schemas"]["tankSkillTree"] | null;
            /** @description The alternate driving modes the vehicle can switch into (siege for Swedish TDs, rapid for wheeled vehicles), each as ratio factors over the base spec plus any gun-arc override. Empty for the vast majority of vehicles, which have no mode. */
            modes: components["schemas"]["vehicleMode"][];
            moeHistory: {
                day: string;
                mark1: number;
                mark2: number;
                mark3: number;
            }[];
            momHistory: {
                day: string;
                class3: number;
                class2: number;
                class1: number;
                ace: number;
            }[];
        };
        /** @description A tank's economics: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1 (cheapest path, prerequisite modules included). */
        TankEconomics: {
            buyCredits: number | null;
            buyGold: number | null;
            shellCost: number | null;
            ammoCost: number | null;
            researchXp: number | null;
            totalFreeXp: number | null;
        };
        TankEconomicsResponse: {
            results: components["schemas"]["TankEconRow"][];
        };
        /** @description A tank's identity and economics. */
        TankEconRow: {
            identity: components["schemas"]["TankIdentity"];
            economics: components["schemas"]["TankEconomics"] | null;
        };
        tankFieldMods: {
            /** @description The post-progression tree: the vehicle's role or its own special tree. */
            treeKey: string;
            steps: components["schemas"]["fieldModStep"][];
        };
        /** @description A vehicle's identity: tier, class, nation, names, tag, premium/reward flags, role and icon URLs. */
        TankIdentity: {
            tankId: number;
            slug: string;
            tier: number;
            type: string;
            nation: string;
            name: string;
            shortName: string;
            tag: string;
            isPremium: boolean;
            isReward: boolean;
            role: string | null;
            contourIcon: string | null;
            bigIcon: string | null;
        };
        tankLoadout: {
            slots: components["schemas"]["equipmentSlot"][];
            equipment: components["schemas"]["loadoutEquipment"][];
            /** @description Directives (battle boosters) that enhance a compatible device, each tied to its equipment; applied on top of the mounted equipment. */
            directives: components["schemas"]["loadoutDirective"][];
            /** @description The consumables the vehicle can mount (repair/first-aid kits, extinguishers, food, fuel, ...) in three generic slots. */
            consumables: components["schemas"]["loadoutConsumable"][];
        };
        /** @description The combined-damage thresholds for the 1st, 2nd and 3rd Marks of Excellence on a tank, mirrored per region. */
        TankMarksOfExcellence: {
            mark1: number | null;
            mark2: number | null;
            mark3: number | null;
        };
        /** @description The XP thresholds for the 3rd/2nd/1st Class and Ace Tanker Mark of Mastery badges on a tank, mirrored per region. */
        TankMarksOfMastery: {
            class3: number | null;
            class2: number | null;
            class1: number | null;
            ace: number | null;
        };
        TankMasteryResponse: {
            results: components["schemas"]["TankMasteryRow"][];
        };
        /** @description A tank's identity and Marks of Mastery. */
        TankMasteryRow: {
            identity: components["schemas"]["TankIdentity"];
            mastery: components["schemas"]["TankMarksOfMastery"] | null;
        };
        tankModuleNode: {
            moduleId: number;
            /** @description WG module class: vehicleChassis, vehicleTurret, vehicleGun, vehicleEngine or vehicleRadio. */
            type: string;
            name: string;
            tier: number | null;
            image: string | null;
            /** @description True for the stock module the tank ships with. */
            isDefault: boolean;
            priceXp: number;
            priceCredit: number;
            /** @description Module ids this one unlocks (edges may cross classes, e.g. a turret unlocking a gun). */
            nextModules: number[];
            /** @description Vehicle ids this module's research opens up. */
            nextTanks: number[];
            /** @description Reference stats for the module (WG default profile), tagged by class via `kind`. */
            stats: components["schemas"]["moduleStats"] | null;
            /** @description Every vehicle that can mount this module, highest tier first. */
            tanks: components["schemas"]["moduleTankRef"][];
        };
        TankMoeResponse: {
            results: components["schemas"]["TankMoeRow"][];
        };
        /** @description A tank's identity and Marks of Excellence. */
        TankMoeRow: {
            identity: components["schemas"]["TankIdentity"];
            moe: components["schemas"]["TankMarksOfExcellence"] | null;
        };
        TankPerfResponse: {
            results: components["schemas"]["TankPerfRow"][];
        };
        /** @description A tank's identity and server performance. */
        TankPerfRow: {
            identity: components["schemas"]["TankIdentity"];
            stats: components["schemas"]["TankServerStats"] | null;
        };
        TankSearchChunk: unknown;
        TankSearchResponse: {
            results: components["schemas"]["TankSummary"][];
        };
        /** @description Server-average performance across tracked players. */
        TankServerStats: {
            players: number;
            avg_battles: number;
            total_battles: number | null;
            avg_damage: number;
            winrate: number;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            player_wr: number | null;
            avg_spots: number | null;
            avg_assist: number | null;
            kdr: number | null;
            hit_pct: number | null;
            pen_pct: number | null;
            avg_blocked: number | null;
            survival: number | null;
            moe1: number | null;
            moe2: number | null;
            moe3: number | null;
            mom_class3: number | null;
            mom_class2: number | null;
            mom_class1: number | null;
            mom_ace: number | null;
        };
        tankSkillTree: {
            rootStep: number;
            nodes: components["schemas"]["skillNode"][];
        };
        /** @description A tank's top-configuration combat specifications: firepower, gun handling, mobility, survivability, concealment and recon. Region-agnostic values. */
        TankSpecifications: {
            damage: number | null;
            moduleDamage: number | null;
            splashRadius: number | null;
            reload: number | null;
            rof: number | null;
            intraClipReload: number | null;
            dpm: number | null;
            penetration: number | null;
            caliber: number | null;
            shellVelocity: number | null;
            accuracy: number | null;
            aimTime: number | null;
            dispMoving: number | null;
            dispTankTraverse: number | null;
            dispTurretTraverse: number | null;
            dispAfterShot: number | null;
            dispWhileDamaged: number | null;
            gunArc: number | null;
            depression: number | null;
            elevation: number | null;
            speedForward: number | null;
            speedBackward: number | null;
            hullTraverse: number | null;
            turretTraverse: number | null;
            enginePower: number | null;
            powerWeight: number | null;
            terrainHard: number | null;
            terrainMedium: number | null;
            terrainSoft: number | null;
            health: number | null;
            engineHealth: number | null;
            engineFireChance: number | null;
            hullArmorFront: number | null;
            turretArmorFront: number | null;
            trackArmor: number | null;
            trackHealth: number | null;
            trackRepairTime: number | null;
            ammoRackHealth: number | null;
            weight: number | null;
            viewRange: number | null;
            radioRange: number | null;
            camoStill: number | null;
            camoMoving: number | null;
            camoStillFiring: number | null;
            camoMovingFiring: number | null;
        };
        /** @description A tank's identity and specifications. */
        TankSpecRow: {
            identity: components["schemas"]["TankIdentity"];
            specifications: components["schemas"]["TankSpecifications"] | null;
        };
        TankSpecsResponse: {
            results: components["schemas"]["TankSpecRow"][];
        };
        /** @description Vehicle row (additional fields may be present). */
        TankSummary: {
            tank_id: number;
            name: string;
            short_name: string;
            tier: number;
            nation: string;
            type: string;
        };
        tierContribution: {
            tier: number;
            count: number;
            unit: number;
            value: number;
        };
        TopClansResponse: {
            results: components["schemas"]["ClanSummary"][];
            computed_at: string | null;
        };
        TopPlayersResponse: {
            results: components["schemas"]["PlayerSummary"][];
            computed_at: string | null;
        };
        topTankPlayer: {
            account_id: number;
            nickname: string;
            clan_tag: string | null;
            clan_color: string | null;
            battles: number;
            avg_damage: number;
            winrate: number;
            /** @description The ranked metric's value. */
            value: number;
        };
        /** @description The tank's catalogue identity. */
        VehicleMeta: {
            tier: number;
            type: string;
            nation: string;
            name: string;
            shortName: string;
            tag: string;
            isPremium: boolean;
            isReward: boolean;
            role: string | null;
            contourIcon: string | null;
            bigIcon: string | null;
        };
        vehicleMode: {
            /** @enum {string} */
            kind: "siege" | "rapid";
            switchOnTime: number;
            switchOffTime: number;
            factors: {
                attribute: string;
                /** @enum {string} */
                type: "mul" | "add";
                value: number;
            }[];
            depression: number | null;
            elevation: number | null;
        };
        /**
         * @description Return the lifetime by-language board (each row carries its inferred languages) without filtering to one language.
         * @enum {string}
         */
        withLanguagesField: "true" | "false";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "get-{region}-players-search": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerSearchResponse"];
                };
            };
        };
    };
    "get-{region}-players-search-ndjson": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerSearchChunk"];
                };
            };
        };
    };
    "get-{region}-players-top": {
        parameters: {
            query?: {
                period?: "24h" | "7d" | "30d" | "overall";
                /** @description Maximum number of rows to return. Out-of-range values are clamped. */
                limit?: number;
                metric?: "wn7" | "wn8" | "wnx";
                language?: components["schemas"]["languageField"];
                strict?: components["schemas"]["strictField"];
                languages?: components["schemas"]["withLanguagesField"];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TopPlayersResponse"];
                };
            };
        };
    };
    "get-{region}-players-compare": {
        parameters: {
            query: {
                /** @description Player nicknames to compare (2 to 4). */
                names: string[];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayersCompare"];
                };
            };
        };
    };
    "get-{region}-players-languages": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerLanguagesResponse"];
                };
            };
        };
    };
    "get-{region}-players-{nickname}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerDetailResponse"];
                };
            };
        };
    };
    "get-{region}-players-{nickname}-clan": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerClan"];
                };
            };
        };
    };
    "get-{region}-players-{nickname}-tanks": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlayerTanksResponse"];
                };
            };
        };
    };
    "post-{region}-players-{nickname}-enqueue": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Estimated seconds until the refresh completes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        estimatedSeconds: number;
                    };
                };
            };
        };
    };
    "get-{region}-players-{nickname}-sse": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "get-{region}-clans-search": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanSearchResponse"];
                };
            };
        };
    };
    "get-{region}-clans-search-ndjson": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanSearchChunk"];
                };
            };
        };
    };
    "get-{region}-clans-stronghold-top": {
        parameters: {
            query?: {
                /** @description Stronghold mode/tier (default t10). */
                tier?: "advances" | "t10" | "t8" | "t6";
                /** @description Ranking column (default sr). */
                sort?: "sr" | "elo" | "battles" | "winrate";
                /** @description Window the stats are computed over: all-time or the last 30 days (default overall). */
                period?: "overall" | "30d";
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StrongholdTopResponse"];
                };
            };
        };
    };
    "get-{region}-clans-top": {
        parameters: {
            query?: {
                period?: components["schemas"]["clanPeriodField"];
                /** @description Maximum number of rows to return. Out-of-range values are clamped. */
                limit?: number;
                metric?: "wn7" | "wn8" | "wnx";
                language?: components["schemas"]["languageField"];
                strict?: components["schemas"]["strictField"];
                languages?: components["schemas"]["withLanguagesField"];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TopClansResponse"];
                };
            };
        };
    };
    "get-{region}-clans-compare": {
        parameters: {
            query: {
                /** @description Clan tags to compare (2 to 4). */
                tags: string[];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClansCompare"];
                };
            };
        };
    };
    "get-{region}-clans-languages": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanLanguagesResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanOverviewResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-members": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanMembersResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-previous-clans": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanPreviousClansResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-activity": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanActivityResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-stronghold": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanStrongholdResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-clan-wars": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanWarsResponse"];
                };
            };
        };
    };
    "get-{region}-clans-{tag}-vehicles": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClanVehiclesResponse"];
                };
            };
        };
    };
    "post-{region}-clans-{tag}-enqueue": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Estimated seconds until the refresh completes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        estimatedSeconds: number;
                    };
                };
            };
        };
    };
    "get-{region}-clans-{tag}-sse": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "get-{region}-tanks-search": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankSearchResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-search-ndjson": {
        parameters: {
            query: {
                /**
                 * @description Search prefix.
                 * @example uni
                 */
                q: string;
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankSearchChunk"];
                };
            };
        };
    };
    "get-{region}-tanks": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankPerfResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-specifications": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankSpecsResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-economics": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankEconomicsResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-marks-of-excellence": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankMoeResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-marks-of-mastery": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankMasteryResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankPerfRow"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-detail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankDetail"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-specifications": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankSpecRow"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-economics": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankEconRow"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-marks-of-excellence": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankMoeRow"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-marks-of-mastery": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankMasteryRow"];
                };
            };
        };
    };
    "get-streamers-live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LiveStreamersResponse"];
                };
            };
        };
    };
    "get-streamers-live-sse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "get-{region}-server-online-sse": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: never;
    };
    "get-{region}-coverage": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Coverage"];
                };
            };
        };
    };
    "get-health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    "get-support-funding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FundingSummary"];
                };
            };
        };
    };
    "get-support-podium": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportersPodium"];
                };
            };
        };
    };
    "post-mcp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["McpResponse"];
                };
            };
        };
    };
    "get-og": {
        parameters: {
            query?: {
                /** @description Card title. */
                title?: string;
                /** @description Card subtitle. */
                subtitle?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
    "get-og-{region}-clans-compare": {
        parameters: {
            query: {
                /** @description Clan tags to compare (2 to 4). */
                tags: string[];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
    "get-og-{region}-players-compare": {
        parameters: {
            query: {
                /** @description Player nicknames to compare (2 to 4). */
                names: string[];
            };
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
    "get-og-{region}-clans-{tag}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Clan tag.
                 * @example FAME
                 */
                tag: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
    "get-og-{region}-players-{nickname}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Player nickname.
                 * @example Animal
                 */
                nickname: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
    "get-og-{region}-tanks-{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Tank slug (e.g. is-7).
                 * @example is-7
                 */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": components["schemas"]["ogImageResponse"];
                };
            };
        };
    };
}
