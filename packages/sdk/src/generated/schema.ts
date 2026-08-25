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
    "/{region}/players/onslaught": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Onslaught leaderboard
         * @description The Onslaught (Competitive 7) ranked leaderboard for a region,
         */
        get: operations["get-{region}-players-onslaught"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/players/steel-hunter": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Steel Hunter leaderboard
         * @description The Steel Hunter (battle-royale) player leaderboard for a region,
         */
        get: operations["get-{region}-players-steel-hunter"];
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
    "/{region}/players/{nickname}/achievements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player achievements
         * @description The full Wargaming medal catalogue with the number of times this player earned each one (0 when never), grouped into Wargaming's own sections and ordered the way the in-game cabinet is. Includes retired event medals, flagged as outdated, so the client can offer them as a filter rather than decide for the reader. 404 when the nickname is unknown in this region.
         */
        get: operations["get-{region}-players-{nickname}-achievements"];
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
    "/{region}/players/{nickname}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player sessions
         * @description What a player played, session by session: battles, average tier, the vehicles taken out, and the per-battle averages and ratings of that stretch alone. The game keeps no session log and Wargaming exposes none, so each bucket is the difference between two consecutive snapshots of the player's vehicles, attributed to when it was observed. Bucketed by day, week or month; newest first. 404 when the player is unknown.
         */
        get: operations["get-{region}-players-{nickname}-sessions"];
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
    "/{region}/players/{nickname}/tanks/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Player vehicle record
         * @description One player's record on one vehicle, in the shape of the game's own Service Record: the general parameters (win rate, survival, hit rate, damage and destruction ratios, armour use) and the per-battle averages, plus the WN7/WN8/WNX the player earned on that tank and their marks. Reads the newest stored snapshot for the pair, so every number carries the same `updated_at`. 404 when we do not track the player, the slug is not a vehicle, or the player has never played it.
         */
        get: operations["get-{region}-players-{nickname}-tanks-{slug}"];
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
    "/{region}/clans/{tag}/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Clan videos
         * @description Every published battle this clan is credited on, newest approved first: the tactics it called and the maps it called them on. A submitter names the clan when suggesting a competitive battle, and it is stored as an id rather than a tag, so a rename never strands the credit. Empty for a clan nobody has credited yet.
         */
        get: operations["get-{region}-clans-{tag}-videos"];
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
    "/{region}/ratings/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My ratings
         * @description Every vehicle the caller has rated, newest first. Its job is to let a page know what is already done: a signed-in player's own garage uses it to suggest the tanks they play most and have not judged yet, which is where most votes come from. Region-independent like the votes themselves, so the same list is served whichever region the page was opened on. Signed out answers an empty list rather than a 401: the caller is asking what they have rated, and "nothing" is the true answer.
         */
        get: operations["get-{region}-ratings-mine"];
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
    "/{region}/tanks/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank changes feed
         * @description The global tank-rebalance feed for a region: recent characteristic changes across every tank, grouped by game version (newest first) and then by tank (heaviest-hit first). Firepower, gun handling, mobility, survivability and concealment buffs and nerfs, as Wargaming ships them. Identity comes from the region's own catalogue, so a tank absent from a server is left out of that server's feed. Values are raw stored values; apply each field's scale to display.
         */
        get: operations["get-{region}-tanks-changes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Compare tanks
         * @description Everything a side-by-side comparison of 2 to 4 vehicles renders (`?slugs=is-7,e-100`): each vehicle's specifications, module combinations, equipment slots, crew and progression, plus its server-average performance. The mountable catalogues (equipment, directives, consumables, crew skills) are hoisted out of the vehicles and described once under `catalog`, referenced by key, and `ranges` carries the catalogue-wide spread of every characteristic so a client can score a vehicle per category. A slug may suffix the game client to read the vehicle on (`?slugs=amx-13-90,amx-13-90@ct`), which is how a vehicle is compared against what the running Common Test makes of it, and every column carries back the `client` it was read on. Duplicate columns collapse, and a slug the catalogue doesn't know is dropped rather than failing the request, as long as two vehicles remain.
         */
        get: operations["get-{region}-tanks-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/ratings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Community ratings board
         * @description Every vehicle players have rated, with what they think of it and how far that is from what it actually does. `overallBayes` is the mean shrunk towards the site-wide average and is what the board sorts on, so a tank three people liked cannot sit above one four hundred have judged. `hype` is the community's rank inside the tier minus the tank's measured win-rate rank inside the same tier: sort it descending for the most overrated vehicles in the game, ascending for the most underrated. Vehicles nobody has rated are absent rather than returned with nulls, so an unrated tank is never read as a badly rated one. The votes are global, the identities are the region's catalogue.
         */
        get: operations["get-{region}-tanks-ratings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Community videos
         * @description Every published battle the community has suggested, newest approved first, whatever the tank. Each entry is a battle rather than a whole video, carrying the second it starts at, so one recording appears once per battle marked in it. The per-tank endpoint returns the same rows filtered to one tank; this one is what shows a video whole, with every tank it covers. Region-independent, the same list is served on every region.
         */
        get: operations["get-{region}-videos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/videos/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My queued videos
         * @description The signed-in user's own suggestions that are still waiting on a moderator, wherever they were filed. Their own only: an unreviewed row is shown to the person waiting on it and to nobody else, which is also why this answers with an empty list rather than an error when signed out. Uncached for the same reason, unlike the published lists beside it. Not scoped to one tank or map: the page that renders it keeps the rows it is about.
         */
        get: operations["get-{region}-videos-mine"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/videos/suggest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suggest a video
         * @description Queue a YouTube link for moderation. Requires a signed-in Wargaming account, so a suggestion always carries who made it. The link must be a YouTube video we can embed, and its timestamp is what marks the battle. A submission is filed under the map it was fought on, which is checked against the catalogue along with the mode, so a battle cannot be filed under a map that never runs it. A random battle also names the vehicle and the damage; a competitive battle names neither, since a tactic belongs to the ground and the side rather than to one player's game. Nothing is published here: a moderator approves it first. 401 when signed out, 404 when submissions are unconfigured, 409 when that exact battle was already submitted.
         */
        post: operations["post-{region}-videos-suggest"];
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
    "/{region}/tanks/{slug}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank changes history
         * @description The characteristic changes a tank has gone through across game versions (buffs and nerfs to firepower, gun handling, mobility, survivability and concealment), grouped by version, newest first. Built forward from the moment tracking started, since Wargaming publishes no archive of past client versions. Values are raw stored values; apply each field's scale to display. 404 when the slug maps to no tank on the region.
         */
        get: operations["get-{region}-tanks-{slug}-history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/rate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rate a tank
         * @description Cast or revise this account's opinion of a vehicle. Requires a signed-in Wargaming account that has actually played the tank: the endpoint reads the caller's own record on it and refuses with 403 below the battle threshold, which is what makes this average worth more than a poll of whoever showed up. One opinion per account per tank, so sending again replaces the previous one rather than adding to it. The evidence the vote rests on (battles, win rate, damage, the account's rating) is copied onto it at the moment it is cast, and the client version is stamped, so an opinion stays attached to the tank it was formed on. A written opinion is queued for moderation and never published here; the stars count immediately. The vote is recorded under the caller's own region, whatever region the page was opened on. 401 when signed out, 403 when the record is too thin, 404 for an unknown tank.
         */
        post: operations["post-{region}-tanks-{slug}-rate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/rate/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Withdraw my rating
         * @description Take back this account's opinion of a vehicle, stars and written text together: what is being withdrawn is the whole verdict, not the sentence explaining it. A POST rather than a DELETE so it is reachable from the generated client, which speaks the two verbs the public API documents. Answering `removed: false` means there was nothing to take back, which is the outcome the caller asked for either way. 401 when signed out, 404 for an unknown tank.
         */
        post: operations["post-{region}-tanks-{slug}-rate-withdraw"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/ratings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank community rating
         * @description What players think of one vehicle, and what that opinion is worth. Unlike every other community average, a vote here can only be cast by an account that has actually taken the tank into battle, and each vote carries the voter's own record on it, so the response splits the verdict by how well the voters play and by which server they play on, alongside the star histograms and the optional per-axis radar. `hype` is the gap between where the community ranks the tank in its tier and where its measured win rate ranks it: positive means overrated, negative underrated. Region-independent, the same verdict is served everywhere; the region in the path only resolves the slug.
         */
        get: operations["get-{region}-tanks-{slug}-ratings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/ratings/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My rating of this tank
         * @description Whether the caller may rate this vehicle, on what evidence, and what they already said about it. The gate is the point: an account has to have taken the tank into battle before its opinion counts, so this answers with their own record on it, how many battles are still missing when they are short, and their existing vote if there is one (including a written opinion still waiting on a moderator, which only its author is shown). Signed out is not an error: it answers `signedIn: false` so the page can offer the sign-in rather than break. The rating is made under the caller's own Wargaming region, whatever region the page was opened on.
         */
        get: operations["get-{region}-tanks-{slug}-ratings-me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/tanks/{slug}/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tank videos
         * @description Community-suggested gameplay videos for one tank, newest approved first. Each entry is a battle rather than a whole video: it carries the second it starts at, so a three-hour stream VOD can be linked at the minute this tank is played. The map, mode and result are declared by the submitter and checked in moderation; the spawn direction is derived from the map's own geometry. Region-independent, the same list is served on every region. Suggesting one is a write, and lives on `/videos/suggest`.
         */
        get: operations["get-{region}-tanks-{slug}-videos"];
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
    "/{region}/search/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resolve saved search entries
         * @description Current rows for a set of entries the caller has saved by id (the search dialog's favorites and recents), in the same shapes the four search endpoints return. Each list is optional and comma separated. Entries that no longer resolve are absent from the response rather than reported, so a caller can keep its own copy for those. Reads cached data only, with no live Wargaming call.
         */
        get: operations["get-{region}-search-resolve"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send feedback
         * @description Forward a message to the team's private Discord channel. Open to everyone, no key and no account: the sender's Wargaming identity is attached from the session when signed in, otherwise the feedback is anonymous. Rate limited per client. 404 when the feature is unconfigured, 400 on a bad body, 429 when rate limited, 502 when it could not be delivered.
         */
        post: operations["post-feedback"];
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
    "/{region}/maps/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search maps
         * @description Search the battle-map catalogue by name (minimum 3 characters), served from our in-memory catalogue. Returns the results in a single JSON response. For the streamed variant (a single `local` chunk), use `/search/ndjson`.
         */
        get: operations["get-{region}-maps-search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps/search/ndjson": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search maps (streamed)
         * @description Search the battle-map catalogue by name (minimum 3 characters). Streams NDJSON with a single `local` chunk served from our in-memory catalogue. For a plain JSON response, use `/search`.
         */
        get: operations["get-{region}-maps-search-ndjson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Maps
         * @description Every World of Tanks battle map on a region: display name, minimap image, camouflage kind (summer/winter/desert), square size in metres, and the random-battle modes it supports (Standard/Encounter/Assault). Derived from the game client scripts, so removed or event-reskin maps are included. One entry per distinct map, name-sorted.
         */
        get: operations["get-{region}-maps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map changes feed
         * @description The global map-change feed: what every game version changed about the game's maps, newest version first and most-changed map first. Play areas resized, game modes and battle types gained or lost, bases, spawns, control points and Onslaught points of interest moved, and maps added to or pulled from the client. Reconstructed from the client's own arena definitions, which Wargaming publishes no archive of. Limited to the maps the region's catalogue currently lists.
         */
        get: operations["get-{region}-maps-changes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/glossary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Glossary
         * @description Every World of Tanks term the site defines: game mechanics, vehicle statistics, battle formats, rating systems and community slang. Each entry carries a one-sentence definition, the other spellings it is searched by, and the section it belongs to. Alphabetical by term. Pass `category` to read one section.
         */
        get: operations["get-glossary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/glossary/anchors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Glossary anchors
         * @description Where each glossary term attaches to the interface: the tank specification columns and the on-screen labels it defines, with the one-sentence definition to show for them. Small by construction (only anchored terms, listed once each), so a client can hold the whole thing and explain a table without another request.
         */
        get: operations["get-glossary-anchors"];
        put?: never;
        post?: never;
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
    "/og/{region}/tanks/compare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tanks comparison OG card
         * @description A side-by-side comparison card (up to 4 vehicles) as a 1200×630 PNG: each vehicle's render over the hangar floor, its tier and class, and its overall catalogue score.
         */
        get: operations["get-og-{region}-tanks-compare"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map detail
         * @description A single battle map with its full geometry: display name, description, minimap image, camouflage kind, size in metres, battle timer, team size, and per-mode base flags, team spawns and control point projected onto the minimap as percentage coordinates. `slug` in the response is the canonical slug.
         */
        get: operations["get-{region}-maps-{slug}"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps/{slug}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map changes history
         * @description Everything a map has been through across game versions, grouped by version, newest first: play area resized, game modes and battle types gained or lost, bases, spawns, control points and Onslaught points of interest moved, and the map entering or leaving the client. Reconstructed from the client's own arena definitions back to update 1.13.0, plus what the running Common Test is about to change. 404 when the slug maps to no map on the region.
         */
        get: operations["get-{region}-maps-{slug}-history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{region}/maps/{slug}/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map videos
         * @description Every published battle the community has linked on this map, newest approved first, whatever format it was played in and whatever it was played in. This is the read behind a tactic library: a Clan Wars or Advances battle is filed under the ground it was fought on and the side it was fought from, not under a vehicle, so the map is the only page it can be looked up from. Random battles come back alongside them, carrying the tank they were played in, and the page filters by format.
         */
        get: operations["get-{region}-maps-{slug}-videos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/glossary/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Glossary term
         * @description One glossary term in full: its definition, the body of the entry with every mention of another term already resolved to that term's slug, the terms it relates to, and the pages of the site it points at.
         */
        get: operations["get-glossary-{slug}"];
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
    "/og/{region}/maps/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Map OG card
         * @description The battle map's card as a stable, hash-free 1200×630 PNG (minimap, size, battle time, team size, modes). Mirrors the page's link-unfurl image for embedding directly (Discord, social share), without the route-group hash Next appends to the file convention's URL.
         */
        get: operations["get-og-{region}-maps-{slug}"];
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
        achievement: {
            id: string;
            name: string;
            description: string;
            condition: string;
            image: string;
            section: string;
            sectionName: string;
            sectionOrder: number;
            order: number;
            type: string;
            outdated: boolean;
            tiers: components["schemas"]["tier"][];
            count: number;
        };
        axisAnswer: {
            axis: components["schemas"]["tankRatingAxisField"];
            value: number;
        };
        axisVerdict: {
            axis: components["schemas"]["tankRatingAxisField"];
            value: number | null;
            votes: number;
        };
        /**
         * @description Format the battle was played in.
         * @enum {string}
         */
        battleFormatField: "random" | "clan_wars" | "advances" | "skirmish" | "maneuvers" | "onslaught" | "tournament";
        /**
         * @description How the battle ended, as declared by the submitter.
         * @enum {string}
         */
        battleResultField: "victory" | "defeat" | "draw";
        bracketVerdict: {
            bracket: components["schemas"]["voterBracketField"];
            votes: number;
            overall: number | null;
            fun: number | null;
            /** @description Mean battles these voters have on the tank, which is what makes the slice credible or not. */
            avgBattles: number | null;
        };
        /** @description A map and the changes a game version made to it. */
        ChangedMap: {
            arenaId: string;
            slug: string;
            name: string;
            minimapUrl: string;
            changes: components["schemas"]["MapChange"][];
        };
        /** @description A tank's identity and the spec changes a game version made to it. */
        ChangedTank: {
            identity: components["schemas"]["TankIdentity"];
            changes: components["schemas"]["TankSpecChange"][];
        };
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
            /** @description Distinct battle-having vehicle count for the clan, materialized from the last /vehicles load. Null until the vehicles tab has been opened at least once. */
            vehiclesCount: number | null;
            /** @description Podium positions the clan currently holds, best rank first. Only the top three of each leaderboard qualify, so this is empty for almost every clan. */
            badges: components["schemas"]["ClanRankBadge"][];
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
        /** @description A podium position (rank 1 to 3) the clan currently holds on one leaderboard. */
        ClanRankBadge: {
            /**
             * @description The leaderboard this placing is on.
             * @enum {string}
             */
            board: "wn7" | "wn8" | "wnx" | "advances" | "t10" | "t8" | "t6";
            rank: number;
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
            sr30d: {
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
            winrate?: number | null;
            badges?: components["schemas"]["ClanRankBadge"][];
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
            role: string | null;
            isReward: boolean;
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
        ClanVideosResponse: {
            videos: components["schemas"]["videoBattleWithTank"][];
        };
        ClanWarsResponse: {
            latest: components["schemas"]["ClanGlobalMapStats"] | null;
            periods: {
                h24: components["schemas"]["ClanGlobalMapStats"] | null;
                d7: components["schemas"]["ClanGlobalMapStats"] | null;
                d30: components["schemas"]["ClanGlobalMapStats"] | null;
            };
        };
        CommunityVideosResponse: {
            videos: components["schemas"]["videoBattleWithTank"][];
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
                /** @description Discord servers our bot is in. Global, not per region. Null when Discord could not be reached. */
                discordServers: number | null;
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
                /** @description Discord servers our bot is in. Global, not per region. Null when Discord could not be reached. */
                discordServers: number | null;
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
        FeedbackBody: {
            /**
             * @description What the feedback is about.
             * @enum {string}
             */
            topic: "bug" | "idea" | "data" | "other";
            /**
             * @description Optional one-tap sentiment.
             * @enum {string}
             */
            sentiment?: "awful" | "bad" | "good" | "great";
            /** @description The feedback itself. */
            message: string;
            /** @description Page it was sent from, for context. */
            page?: string;
            /** @description Analytics session id, when the sender's browser captured one. */
            umamiSessionId?: string;
            /** @description Set by the Discord bot instead of a web session. Shown as an unverified handle: the endpoint is public, so this is a self-reported label rather than a trusted identity. */
            discordAuthor?: {
                id: string;
                username: string;
            };
        };
        FeedbackResponse: {
            ok: boolean;
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
        formulaBlock: {
            kind: string;
            expression: string;
            note?: string;
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
        GlossaryAnchorsResponse: {
            terms: components["schemas"]["GlossaryAnchorTerm"][];
            /** @description Tank specification column to the slug that defines it. */
            bySpecKey: {
                [key: string]: string;
            };
            /** @description Lowercased interface label to the slug that defines it. */
            byLabel: {
                [key: string]: string;
            };
        };
        /** @description A term as a tooltip renders it. */
        GlossaryAnchorTerm: {
            slug: string;
            term: string;
            short: string;
        };
        /** @description One block of a definition: a paragraph, a list or a formula. */
        GlossaryBlock: components["schemas"]["paragraphBlock"] | components["schemas"]["listBlock"] | components["schemas"]["formulaBlock"];
        /**
         * @description Section of the glossary a term belongs to.
         * @enum {string}
         */
        glossaryCategoryField: "vehicles" | "gunnery" | "armor" | "mobility" | "vision" | "crew" | "progression" | "economy" | "ratings" | "statistics" | "modes" | "tactics" | "slang";
        glossaryLink: {
            /**
             * @description Which page of the site the link leads to.
             * @enum {string}
             */
            target: "top-players" | "top-clans" | "tanks" | "tank-economics" | "marks-of-excellence" | "marks-of-mastery" | "tank-changes" | "maps" | "stronghold" | "advances" | "onslaught" | "steel-hunter" | "coverage" | "docs" | "tank" | "map";
            slug?: string;
            label?: string;
        };
        GlossaryListResponse: {
            results: components["schemas"]["GlossaryTermSummary"][];
        };
        glossarySegment: {
            text: string;
            slug?: string;
        };
        GlossaryTermResponse: {
            slug: string;
            term: string;
            aliases: string[];
            category: components["schemas"]["glossaryCategoryField"];
            short: string;
            body: components["schemas"]["GlossaryBlock"][];
            related: components["schemas"]["GlossaryTermSummary"][];
            links: components["schemas"]["glossaryLink"][];
        };
        /** @description A glossary term without its body. */
        GlossaryTermSummary: {
            slug: string;
            term: string;
            /** @description Other spellings the term is known and searched by. */
            aliases: string[];
            category: components["schemas"]["glossaryCategoryField"];
            /** @description One-sentence definition, complete on its own. */
            short: string;
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
        listBlock: {
            kind: string;
            items: components["schemas"]["glossarySegment"][][];
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
        /**
         * @description Top-level battle type a map belongs to.
         * @enum {string}
         */
        mapBattleTypeField: "random" | "battle_royale" | "frontline" | "onslaught" | "grand_battle" | "clan_wars" | "waffentrager" | "last_stand" | "arcade" | "story_mode" | "training";
        /**
         * @description Vehicle camouflage kind the map is skinned with.
         * @enum {string}
         */
        mapCamouflageField: "summer" | "winter" | "desert";
        /** @description A change to one map property between two game versions, with the before/after values. `field` is a tracked scalar (roundLength, widthMeters, heightMeters, maxPlayersInTeam, camouflage), a mode or battle type the map gained or lost (mode:standard, battleType:onslaught), a mode's play area (playArea:comp7), a marker group (geometry:ctf:bases:team1, whose value is a JSON array of [x, z] positions in metres from the play area's bottom-left corner), or the map entering or leaving the client (presence). Either side is null when the property did not exist then. */
        MapChange: {
            field: string;
            previous: string | null;
            next: string | null;
        };
        MapChangesResponse: {
            versions: components["schemas"]["MapChangesVersion"][];
        };
        /** @description Every map a game version changed, newest version first, most-changed map first. */
        MapChangesVersion: {
            gameVersion: string;
            /** Format: date-time */
            capturedAt: Date;
            maps: components["schemas"]["ChangedMap"][];
        };
        /** @description A battle map's gallery summary. */
        MapDetailResponse: {
            arenaId: string;
            slug: string;
            name: string;
            camouflage: components["schemas"]["mapCamouflageField"];
            /** @description Square side length in metres. */
            sizeMeters: number;
            modes: components["schemas"]["mapModeField"][];
            battleTypes: components["schemas"]["mapBattleTypeField"][];
            minimapUrl: string;
            /** @description Standard-mode base positions, for the gallery thumbnail. */
            bases: components["schemas"]["teamMarkers"];
            description: string;
            /** @description Battle timer in seconds. */
            roundLength: number;
            maxPlayersInTeam: number;
            widthMeters: number;
            heightMeters: number;
            geometry: components["schemas"]["MapModeGeometry"][];
            onslaught: components["schemas"]["MapOnslaught"] | null;
        };
        MapHistoryResponse: {
            arenaId: string;
            slug: string;
            name: string;
            versions: components["schemas"]["MapHistoryVersion"][];
            /** @description The game version the map entered the client in, or null when it predates our version tracking (in which case it was there before the first tracked update). */
            addedVersion: string | null;
            /** Format: date-time */
            addedAt: Date | null;
            /** @description The game version that pulled the map from the client, when it is currently gone. Seasonal maps come back, so this is a state rather than an end. */
            removedVersion: string | null;
            /** Format: date-time */
            removedAt: Date | null;
            /** @description Whether the client currently ships the map. */
            present: boolean;
            /** @description Whether the map has ever been recorded. False for the arenas the client names but does not define, which have no geometry to compare and no knowable introduction. */
            tracked: boolean;
            /** @description The Common Test build these pending changes were read from. */
            testVersion: string | null;
            testChanges: components["schemas"]["MapChange"][];
        };
        /** @description The changes a game version made to a map, with when they were recorded. */
        MapHistoryVersion: {
            gameVersion: string;
            /** Format: date-time */
            capturedAt: Date;
            changes: components["schemas"]["MapChange"][];
        };
        mapMarker: {
            left: number;
            top: number;
        };
        /**
         * @description Random-battle game mode a map supports.
         * @enum {string}
         */
        mapModeField: "standard" | "encounter" | "assault";
        /** @description Base flags, team spawns and control point for one game mode. */
        MapModeGeometry: {
            mode: components["schemas"]["mapModeField"];
            label: string;
            bases: components["schemas"]["teamMarkers"];
            spawns: components["schemas"]["teamMarkers"];
            controlPoint: components["schemas"]["mapMarker"] | null;
        };
        /** @description Onslaught (comp7) minimap, reduced play area and geometry. */
        MapOnslaught: {
            minimapUrl: string;
            widthMeters: number;
            heightMeters: number;
            spawns: components["schemas"]["teamMarkers"];
            controlPoint: components["schemas"]["mapMarker"] | null;
            pointsOfInterest: {
                marker: components["schemas"]["mapMarker"];
                type: number;
            }[];
        };
        /** @description Map row (additional fields may be present). */
        MapResolved: {
            arena_id: string;
            slug: string;
            name: string;
            camouflage: string;
            minimap_url: string;
        };
        MapSearchChunk: unknown;
        MapSearchResponse: {
            results: components["schemas"]["MapSearchRow"][];
        };
        /** @description Map row (additional fields may be present). */
        MapSearchRow: {
            arena_id: string;
            slug: string;
            name: string;
            camouflage: string;
            minimap_url: string;
        };
        MapsListResponse: {
            results: components["schemas"]["MapSummary"][];
        };
        /** @description A battle map's gallery summary. */
        MapSummary: {
            arenaId: string;
            slug: string;
            name: string;
            camouflage: components["schemas"]["mapCamouflageField"];
            /** @description Square side length in metres. */
            sizeMeters: number;
            modes: components["schemas"]["mapModeField"][];
            battleTypes: components["schemas"]["mapBattleTypeField"][];
            minimapUrl: string;
            /** @description Standard-mode base positions, for the gallery thumbnail. */
            bases: components["schemas"]["teamMarkers"];
        };
        MapVideosResponse: {
            videos: components["schemas"]["videoBattleWithTank"][];
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
        MyVideosResponse: {
            videos: components["schemas"]["videoBattleWithTank"][];
        };
        /** @description A 1200×630 PNG stats card. */
        ogImageResponse: string;
        OnslaughtResponse: {
            season: components["schemas"]["OnslaughtSeason"] | null;
            seasons: components["schemas"]["OnslaughtSeasonRef"][];
            results: components["schemas"]["OnslaughtSummary"][];
        };
        /** @description Onslaught season metadata. */
        OnslaughtSeason: {
            eventId: string;
            name: string;
            /** @description Season codename ('Season of the Jade Dragon'), from the client; null if unavailable. */
            codename: string | null;
            /** @description Season ordinal word ('third' for Jade), selecting its themed rank art. */
            seasonOrdinal: string | null;
            /** @description Mirror commit to build rank-art URLs from (null = live branch); pins a past season's art to when it was live. */
            assetsRef: string | null;
            startDate: string | null;
            endDate: string | null;
            /** @description True once the season has ended (standings are final). */
            ended: boolean;
            /** @description Top N ranks that are Elite tier. */
            elitePosition: number | null;
            /** @description Top N ranks that are at least Master (as far as the board reaches). */
            masterPosition: number | null;
            /** @description Unix seconds of the source's last leaderboard recompute. */
            lastRecalculationTs: number | null;
        };
        /** @description A season selector entry. */
        OnslaughtSeasonRef: {
            /** @description Stable list key. */
            key: string;
            /** @description Display label ('Season of the Jade Dragon' or 'Year of the Griffin'). */
            label: string;
            /** @description True when we hold standings for this season (selectable). */
            available: boolean;
            /** @description Season id to navigate to (available seasons only). */
            eventId: string | null;
        };
        /** @description Onslaught leaderboard row (ranked by score). */
        OnslaughtSummary: {
            /** @description Leaderboard position (1-based), from the game source. */
            rank: number;
            account_id: number;
            /** @description Current nickname, resolved by account_id. */
            nickname: string;
            clan_tag: string | null;
            clan_color: string | null;
            /** @description Nickname as recorded on the leaderboard when ranked. */
            recordedNickname: string;
            recordedClanTag: string | null;
            recordedClanColor: string | null;
            /** @description Season score / rating points (the ranking metric). */
            rating: number;
            /** @description Battles played in the mode over the season. */
            battles: number;
            is_verified?: boolean;
            is_supporter?: boolean;
            twitch_login?: string | null;
        };
        ownRating: {
            overall: number;
            fun: number;
            axes: components["schemas"]["axisAnswer"][];
            review: string | null;
            reviewStatus: components["schemas"]["tankReviewStatusField"];
            /** @description Their battles on the tank when the vote was last saved. */
            battles: number;
            gameVersion: string | null;
            /** Format: date-time */
            updatedAt: Date;
        };
        ownRatingRow: {
            tankId: number;
            overall: number;
            fun: number;
            /** @description Their battles on the tank when the vote was last saved. */
            battles: number;
            reviewStatus: components["schemas"]["tankReviewStatusField"];
            /** Format: date-time */
            updatedAt: Date;
        };
        OwnRatingsResponse: {
            ratings: components["schemas"]["ownRatingRow"][];
        };
        paragraphBlock: {
            kind: string;
            segments: components["schemas"]["glossarySegment"][];
        };
        /** @description One derived value per column: lifetime, 24h, 7d, 30d. */
        PeriodValues: {
            total: number | null;
            h24: number | null;
            d7: number | null;
            d30: number | null;
        };
        PlayerAchievementsResponse: {
            achievements: components["schemas"]["achievement"][];
            sections: components["schemas"]["section"][];
            earned: number;
            total: number;
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
            achievementCount: number;
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
        /** @description One bucket of play: what an account did over that day, week or month. */
        PlayerSession: {
            /** @description ISO date of the bucket's first day. */
            period: string;
            /** @description Distinct vehicles taken into battle. */
            tanks: number;
            avgTier: number | null;
            vehicles: components["schemas"]["SessionVehicle"][];
            battles: number;
            /** @description Ratio in 0..1, not a percentage. */
            winrate: number;
            avgDamage: number;
            avgFrags: number;
            avgSpotted: number;
            avgDefense: number;
            avgAssist: number;
            avgXp: number | null;
            survivalRate: number | null;
            /** @description Frags over deaths. Null when nothing died. */
            kd: number | null;
            /** @description Damage dealt over damage taken. Null on sessions whose snapshots predate that counter. */
            damageRatio: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
        };
        /** @description One player's play sessions, newest first. */
        PlayerSessions: {
            granularity: string;
            sessions: components["schemas"]["PlayerSession"][];
        };
        /** @description One player's play sessions, newest first. */
        PlayerSessionsResponse: {
            granularity: string;
            sessions: components["schemas"]["PlayerSession"][];
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
            winrate?: number | null;
            is_verified?: boolean;
            is_supporter?: boolean;
            twitch_login?: string | null;
        };
        /** @description One player's record on one vehicle. */
        PlayerTankDetail: {
            tankId: number;
            slug: string | null;
            name: string;
            shortName: string | null;
            tier: number | null;
            nation: string | null;
            type: string | null;
            role: string | null;
            isPremium: boolean;
            isReward: boolean;
            /**
             * Format: date-time
             * @description When the snapshot these numbers come from was taken.
             */
            updatedAt: Date;
            battles: number;
            /** @description Mark of Mastery, 0-4. */
            mom: number | null;
            /** @description Marks of Excellence on the gun, 0-3. */
            moe: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            /** @description Ratio in 0..1, not a percentage. */
            winrate: number;
            survivalRate: number | null;
            hitRate: number | null;
            /** @description Damage dealt over damage taken. */
            damageRatio: number | null;
            /** @description Frags over deaths. Null on a tank never lost. */
            destructionRatio: number | null;
            /** @description Wargaming's own armour use factor. */
            armorUseEfficiency: number | null;
            stuns: number | null;
            avgXp: number | null;
            avgDamage: number;
            avgDamageReceived: number | null;
            avgAssist: number;
            avgAssistRadio: number;
            avgAssistTrack: number;
            avgAssistStun: number | null;
            avgBlocked: number | null;
            avgSpotted: number;
            avgFrags: number;
            avgCapture: number | null;
            avgDefense: number;
            avgStuns: number | null;
            /** @description Best single battle on the vehicle: the game's Record Score. */
            maxXp: number | null;
            maxFrags: number | null;
            /** @description Daily rating series for this player on this vehicle, over the last 90 days. */
            ratingHistory: components["schemas"]["TankRatingHistoryPoint"][];
            /** @description Medals earned on this vehicle, in the game's own cabinet order. Earned only, and null when they are not known for this player yet. */
            awards: components["schemas"]["TankAward"][] | null;
        };
        /** @description One player's record on one vehicle. */
        PlayerTankDetailResponse: {
            tankId: number;
            slug: string | null;
            name: string;
            shortName: string | null;
            tier: number | null;
            nation: string | null;
            type: string | null;
            role: string | null;
            isPremium: boolean;
            isReward: boolean;
            /**
             * Format: date-time
             * @description When the snapshot these numbers come from was taken.
             */
            updatedAt: Date;
            battles: number;
            /** @description Mark of Mastery, 0-4. */
            mom: number | null;
            /** @description Marks of Excellence on the gun, 0-3. */
            moe: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
            /** @description Ratio in 0..1, not a percentage. */
            winrate: number;
            survivalRate: number | null;
            hitRate: number | null;
            /** @description Damage dealt over damage taken. */
            damageRatio: number | null;
            /** @description Frags over deaths. Null on a tank never lost. */
            destructionRatio: number | null;
            /** @description Wargaming's own armour use factor. */
            armorUseEfficiency: number | null;
            stuns: number | null;
            avgXp: number | null;
            avgDamage: number;
            avgDamageReceived: number | null;
            avgAssist: number;
            avgAssistRadio: number;
            avgAssistTrack: number;
            avgAssistStun: number | null;
            avgBlocked: number | null;
            avgSpotted: number;
            avgFrags: number;
            avgCapture: number | null;
            avgDefense: number;
            avgStuns: number | null;
            /** @description Best single battle on the vehicle: the game's Record Score. */
            maxXp: number | null;
            maxFrags: number | null;
            /** @description Daily rating series for this player on this vehicle, over the last 90 days. */
            ratingHistory: components["schemas"]["TankRatingHistoryPoint"][];
            /** @description Medals earned on this vehicle, in the game's own cabinet order. Earned only, and null when they are not known for this player yet. */
            awards: components["schemas"]["TankAward"][] | null;
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
        /**
         * @description Why a signed-in account may not rate this tank yet.
         * @enum {string}
         */
        ratingBlockField: "no_record" | "never_played" | "too_few_battles";
        /**
         * @description How far apart the voters sit, read off the spread.
         * @enum {string}
         */
        ratingConsensusField: "agreed" | "mixed" | "divisive";
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
        regionVerdict: {
            /**
             * @description Game server region.
             * @enum {string}
             */
            region: "eu" | "na" | "asia";
            votes: number;
            overall: number | null;
            fun: number | null;
        };
        researchPathItem: {
            tankId: number;
            slug: string;
            meta: components["schemas"]["VehicleMeta"];
            researchXp: number | null;
            buyCredits: number | null;
        };
        /**
         * @description What became of a written opinion attached to a rating.
         * @enum {string}
         */
        reviewOutcomeField: "none" | "queued" | "published" | "pending" | "rejected" | "closed";
        SearchResolveResponse: {
            players: components["schemas"]["PlayerSearchHit"][];
            clans: components["schemas"]["ClanSummary"][];
            tanks: components["schemas"]["TankResolved"][];
            maps: components["schemas"]["MapResolved"][];
        };
        section: {
            id: string;
            name: string;
            order: number;
            earned: number;
            total: number;
        };
        /** @description One vehicle's share of a session. */
        SessionVehicle: {
            tankId: number;
            slug: string | null;
            name: string;
            shortName: string | null;
            tier: number | null;
            nation: string | null;
            type: string | null;
            isPremium: boolean;
            isReward: boolean;
            battles: number;
            /** @description Ratio in 0..1, not a percentage. */
            winrate: number;
            avgDamage: number;
            avgFrags: number;
            avgSpotted: number;
            avgDefense: number;
            avgAssist: number;
            avgXp: number | null;
            survivalRate: number | null;
            /** @description Frags over deaths. Null when nothing died. */
            kd: number | null;
            /** @description Damage dealt over damage taken. Null on sessions whose snapshots predate that counter. */
            damageRatio: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
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
         * @description Side of the map a team starts from.
         * @enum {string}
         */
        spawnDirectionField: "north" | "south" | "east" | "west";
        specRange: {
            low: number;
            high: number;
        };
        starBar: {
            /** @description 1 to 5. */
            stars: number;
            votes: number;
            /** @description Share of this tank's votes, 0 to 1. */
            share: number;
        };
        stars: number;
        SteelHunterResponse: {
            results: components["schemas"]["SteelHunterSummary"][];
        };
        /** @description Steel Hunter leaderboard row (ranked by HR). */
        SteelHunterSummary: {
            account_id: number;
            nickname: string;
            clan_tag: string | null;
            clan_color: string | null;
            hr: number;
            hrb: number;
            battles: number;
            wins: number;
            survived: number;
            damage: number;
            frags: number;
            is_verified?: boolean;
            is_supporter?: boolean;
            twitch_login?: string | null;
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
            /** @description Battles-based Stronghold Rating: SR bumped by battle volume (SR times 1 + ln(1 + battles/1000)), one absolute scale across tiers. */
            srb: number | null;
            /** @description Leaderboard placings the clan currently holds, best rank first. */
            badges?: components["schemas"]["ClanRankBadge"][];
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
        /** @description One medal earned on this vehicle. For a tiered medal the count is the tier reached, not a number of awards. */
        TankAward: {
            id: string;
            name: string;
            description: string;
            condition: string;
            image: string;
            section: string;
            sectionName: string;
            sectionOrder: number;
            order: number;
            type: string;
            outdated: boolean;
            tiers: {
                name: string;
                image: string;
            }[];
            count: number;
        };
        TankChangesResponse: {
            versions: components["schemas"]["TankChangesVersion"][];
        };
        /** @description Every tank a game version rebalanced, newest first, heaviest-hit tank first. */
        TankChangesVersion: {
            gameVersion: string;
            /** Format: date-time */
            capturedAt: Date;
            tanks: components["schemas"]["ChangedTank"][];
        };
        /** @description The mountable catalogues shared by the compared vehicles, described once: every device, directive, consumable and crew skill any of them can mount. Each vehicle references them by key. */
        TankCompareCatalog: {
            equipment: components["schemas"]["loadoutEquipment"][];
            directives: components["schemas"]["loadoutDirective"][];
            consumables: components["schemas"]["loadoutConsumable"][];
            crewSkills: components["schemas"]["crewSkill"][];
        };
        /** @description One column of a comparison: a vehicle's identity, what it is made of, what it can mount, and its server-average performance. */
        TankCompareVehicle: {
            tankId: number;
            /** @description Canonical slug. Callers that reached a vehicle through a legacy id or wrong-case slug should redirect to it. It carries no client suffix: `client` below says which one this column is. */
            slug: string;
            /**
             * @description The game client this column was read on. `ct` when the query asked for it, and always for a vehicle that exists only on the test client.
             * @enum {string}
             */
            client: "live" | "ct";
            /** @description The Common Test build available for this vehicle, e.g. `2.4.0.5415`. Null when no test is running or when it leaves the vehicle alone. */
            testVersion: string | null;
            meta: components["schemas"]["VehicleMeta"];
            /** @description The vehicle's top-configuration combat specification, same shape as the `/specifications` endpoints. */
            specs: string | null;
            modules: components["schemas"]["tankModuleNode"][];
            /** @description Every selectable module combination with its derived specs, so a column re-renders its characteristics from the modules picked on it. */
            configs: components["schemas"]["tankConfig"][];
            modes: components["schemas"]["vehicleMode"][];
            /** @description The vehicle's equipment slots plus the catalogue keys it can mount, resolved against `catalog`. Null when the wot-src catalogue has nothing for it. */
            loadout: {
                slots: components["schemas"]["equipmentSlot"][];
                equipmentKeys: string[];
                directiveKeys: string[];
                consumableKeys: string[];
            } | null;
            /** @description The vehicle's crew composition plus the skill keys its members can train, resolved against `catalog.crewSkills`. */
            crew: {
                members: components["schemas"]["crewMember"][];
                skillKeys: string[];
            } | null;
            fieldMods: components["schemas"]["tankFieldMods"] | null;
            skillTree: components["schemas"]["tankSkillTree"] | null;
            stats: components["schemas"]["TankServerStats"] | null;
            moe: {
                mark1: number;
                mark2: number;
                mark3: number;
            } | null;
            mastery: {
                class3: number;
                class2: number;
                class1: number;
                ace: number;
            } | null;
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
            /** @description Whether the tank has anything on its History tab: a recorded characteristic change, or a known lifecycle event (release / dev). Drives the History tab's visibility. */
            hasHistory: boolean;
            /**
             * @description Which game client these characteristics were read from. Only the vehicle's own data follows it: server stats, marks and best players always come from the region's live client, since a test server has no players to measure.
             * @enum {string}
             */
            client: "live" | "ct";
            /** @description The Common Test build that rebalances this tank, e.g. `2.4.0.5415`. Null when no test is running or when this one leaves the vehicle alone. Present whichever client the payload is for, so a caller can offer the other one. */
            testVersion: string | null;
            /** @description The community's verdict in three figures, for the hero badge and the page's structured data. The full breakdown is on `/ratings`. */
            rating: {
                /** @description Plain mean of the community's Overall stars, 1 to 5. */
                overall: number | null;
                votes: number;
                reviewCount: number;
            };
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
            /** @description Whether the tank has anything on its History tab: a recorded characteristic change, or a known lifecycle event (release / dev). Drives the History tab's visibility. */
            hasHistory: boolean;
            /**
             * @description Which game client these characteristics were read from. Only the vehicle's own data follows it: server stats, marks and best players always come from the region's live client, since a test server has no players to measure.
             * @enum {string}
             */
            client: "live" | "ct";
            /** @description The Common Test build that rebalances this tank, e.g. `2.4.0.5415`. Null when no test is running or when this one leaves the vehicle alone. Present whichever client the payload is for, so a caller can offer the other one. */
            testVersion: string | null;
            /** @description The community's verdict in three figures, for the hero badge and the page's structured data. The full breakdown is on `/ratings`. */
            rating: {
                /** @description Plain mean of the community's Overall stars, 1 to 5. */
                overall: number | null;
                votes: number;
                reviewCount: number;
            };
        };
        /** @description A tank's economics: purchase price (credits / gold), shell and ammo cost, research XP from its direct parent, and total free XP to reach it from a tier 1 (cheapest path, prerequisite modules included). */
        TankEconomics: {
            buyCredits: number | null;
            buyGold: number | null;
            shellCost: number | null;
            ammoCost: number | null;
            researchXp: number | null;
            totalFreeXp: number | null;
            freeXpByTier: {
                [key: string]: number;
            } | null;
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
        TankHistoryResponse: {
            tankId: number;
            slug: string;
            versions: components["schemas"]["TankHistoryVersion"][];
            /** @description The Common Test build these pending changes were read from. */
            testVersion: string | null;
            testChanges: {
                field: string;
                previous: number | null;
                next: number | null;
            }[];
            /** @description The game version the tank first appeared as a dev stub (placeholder stats, before balancing), or null when it predates our version tracking. */
            devVersion: string | null;
            /** Format: date-time */
            devAt: Date | null;
            /** @description The game version the tank was released in (its first real spec), or null when it predates our version tracking. */
            releasedVersion: string | null;
            /** Format: date-time */
            releasedAt: Date | null;
        };
        /** @description The characteristic changes a game version made to a tank, with when they were recorded. */
        TankHistoryVersion: {
            gameVersion: string;
            /** Format: date-time */
            capturedAt: Date;
            changes: components["schemas"]["TankSpecChange"][];
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
            /** @description Only on the Common Test client, not yet released. */
            isCommonTest: boolean;
            /** @description How many characteristics the current Common Test build changes on this vehicle; 0 when none. */
            testChanges?: number;
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
        TankRateBody: {
            /** @description How good the tank is, all considered. */
            overall: components["schemas"]["stars"];
            /** @description How much the voter enjoys playing it. */
            fun: components["schemas"]["stars"];
            firepower?: components["schemas"]["stars"] | null;
            armour?: components["schemas"]["stars"] | null;
            mobility?: components["schemas"]["stars"] | null;
            gunHandling?: components["schemas"]["stars"] | null;
            concealment?: components["schemas"]["stars"] | null;
            beginnerFriendliness?: components["schemas"]["stars"] | null;
            versatility?: components["schemas"]["stars"] | null;
            /** @description A written opinion, queued for moderation rather than published. Send null to withdraw one previously written; leaving the field out entirely keeps whatever is already there. Measured after whitespace is collapsed. */
            review?: string | null;
        };
        TankRateRefusedResponse: {
            /** @enum {string} */
            error: "not_eligible";
            block: components["schemas"]["ratingBlockField"] | null;
            required: number;
            battles: number | null;
        };
        TankRateResponse: {
            ok: boolean;
            /** @description What became of the written opinion. Distinguishes text newly queued from text that was already published, still pending, previously rejected, or dropped because written opinions are closed. A boolean here would have claimed 'with a moderator' about prose that was rejected weeks ago. */
            review: components["schemas"]["reviewOutcomeField"];
        };
        TankRateReviewLengthResponse: {
            /** @enum {string} */
            error: "review_length";
            min: number;
            max: number;
        };
        TankRateWithdrawResponse: {
            ok: boolean;
            removed: boolean;
        };
        /**
         * @description An axis a vehicle is rated on.
         * @enum {string}
         */
        tankRatingAxisField: "overall" | "fun" | "firepower" | "armour" | "mobility" | "gunHandling" | "concealment" | "beginnerFriendliness" | "versatility";
        TankRatingBoardResponse: {
            results: components["schemas"]["TankRatingRow"][];
            /** @description Votes cast across every vehicle, for the board's header. */
            totalVotes: number;
            ratedTanks: number;
            /**
             * Format: date-time
             * @description When the rollup behind the shrunk means and the hype column was last recomputed.
             */
            computedAt: Date | null;
        };
        /** @description Daily rating sample for one player on one vehicle: the value carried by every battle fought on it, and the value of the battles fought that day. */
        TankRatingHistoryPoint: {
            day: string;
            lifetime: components["schemas"]["ratingMetricValues"];
            session: components["schemas"]["ratingMetricValues"];
        };
        TankRatingMeResponse: {
            signedIn: boolean;
            /** @description The server the caller votes on, read from their own account rather than from the path. Null when signed out. */
            votingRegion: ("eu" | "na" | "asia") | null;
            eligible: boolean;
            block: components["schemas"]["ratingBlockField"] | null;
            /** @description Battles on the tank an account needs before it may rate it. */
            required: number;
            record: components["schemas"]["voterRecord"] | null;
            player: components["schemas"]["voterProfile"] | null;
            rating: components["schemas"]["ownRating"] | null;
            /** @description Whether written opinions are being accepted. False closes the text field and leaves the stars working, since they need no moderation. */
            reviewsOpen: boolean;
        };
        /** @description A vehicle's community verdict, next to how it actually performs. */
        TankRatingRow: {
            identity: components["schemas"]["TankIdentity"];
            votes: number;
            /** @description Published written opinions on this vehicle. */
            reviews: number;
            /** @description Plain mean of the Overall stars, 1 to 5. */
            overall: number | null;
            fun: number | null;
            /** @description The Overall mean shrunk towards the site-wide average. Sort on this, not on the plain mean, or the top of the board is whichever tank three people rated. */
            overallBayes: number | null;
            funBayes: number | null;
            /** @description How far apart the voters sit. High marks a divisive tank. */
            overallStddev: number | null;
            /** @description Where the community ranks it among the rated vehicles of its own tier, 0 to 1. */
            perceivedPercentile: number | null;
            /** @description Where its measured win rate ranks it among that same set, 0 to 1. Null until the tier has enough rated vehicles for a rank to mean anything. */
            measuredPercentile: number | null;
            /** @description Perceived minus measured. Positive means the community rates it above what it does, negative below. */
            hype: number | null;
        };
        TankRatingsResponse: {
            tankId: number;
            votes: number;
            /** @description Plain mean of the Overall stars, 1 to 5. */
            overall: number | null;
            fun: number | null;
            /** @description The Overall mean shrunk towards the site-wide average, which is what the boards rank on so a four-vote tank cannot top them. Null until the rollup cron has run. */
            overallBayes: number | null;
            funBayes: number | null;
            overallStddev: number | null;
            /** @description How far apart the voters sit. Null under ten votes, where a spread is noise rather than a disagreement. */
            consensus: components["schemas"]["ratingConsensusField"] | null;
            overallDistribution: components["schemas"]["starBar"][];
            funDistribution: components["schemas"]["starBar"][];
            brackets: components["schemas"]["bracketVerdict"][];
            regions: components["schemas"]["regionVerdict"][];
            axes: components["schemas"]["axisVerdict"][];
            /** @description How many voters filled in the optional axes, always far fewer than the headline count. */
            axisVotes: number;
            /** @description Mean battles on the tank across everyone who voted: whether this average was formed by people who play it. */
            avgVoterBattles: number | null;
            /** @description Where the community's verdict sits among the rated vehicles of the same tier, 0 to 1. */
            perceivedPercentile: number | null;
            /** @description Where the tank's measured win rate sits among that same set, 0 to 1. Both halves are ranked over the rated vehicles of the tier so their difference is in one unit. */
            measuredPercentile: number | null;
            /** @description Perceived minus measured. Positive means the community rates it above what it actually does. */
            hype: number | null;
            reviews: components["schemas"]["tankReview"][];
            /** @description Published written opinions in total. Not the length of `reviews`, which is capped. */
            reviewCount: number;
        };
        /** @description Vehicle row (additional fields may be present). */
        TankResolved: {
            tank_id: number;
            slug: string;
            name: string;
            short_name: string;
            tier: number;
            nation: string;
            type: string;
        };
        tankReview: {
            id: number;
            nickname: string;
            /**
             * @description Game server region.
             * @enum {string}
             */
            region: "eu" | "na" | "asia";
            overall: number;
            fun: number;
            /** @description The author's battles on this tank when they wrote it. */
            battles: number;
            winrate: number | null;
            avgDamage: number | null;
            marksOnGun: number | null;
            bracket: components["schemas"]["voterBracketField"];
            playerWn8: number | null;
            /** @description Client version the opinion was formed under, so a reader can see it predates a rebalance. */
            gameVersion: string | null;
            body: string;
            /** Format: date-time */
            createdAt: Date;
        };
        /**
         * @description Where a written opinion stands in moderation.
         * @enum {string}
         */
        tankReviewStatusField: "none" | "pending" | "approved" | "rejected";
        /** @description Everything a side-by-side vehicle comparison renders: each vehicle's configurable data, the mountable catalogues they share, and the catalogue-wide spread of every characteristic. */
        TanksCompare: {
            /** @description The compared vehicles, in the requested order. A slug the catalogue doesn't know is dropped rather than failing the request, so the array can be shorter than the query. */
            vehicles: components["schemas"]["TankCompareVehicle"][];
            catalog: components["schemas"]["TankCompareCatalog"];
            /** @description Where each specification sits across the whole vehicle catalogue, as its 5th (`low`) and 95th (`high`) percentile, keyed by specification field. Percentiles rather than min/max so a single outlier vehicle doesn't flatten the scale. Lets a client read a value as a position in the catalogue (and score a vehicle per category) rather than as a bare number. */
            ranges: {
                [key: string]: components["schemas"]["specRange"];
            };
        };
        /** @description Everything a side-by-side vehicle comparison renders: each vehicle's configurable data, the mountable catalogues they share, and the catalogue-wide spread of every characteristic. */
        TanksCompareResponse: {
            /** @description The compared vehicles, in the requested order. A slug the catalogue doesn't know is dropped rather than failing the request, so the array can be shorter than the query. */
            vehicles: components["schemas"]["TankCompareVehicle"][];
            catalog: components["schemas"]["TankCompareCatalog"];
            /** @description Where each specification sits across the whole vehicle catalogue, as its 5th (`low`) and 95th (`high`) percentile, keyed by specification field. Percentiles rather than min/max so a single outlier vehicle doesn't flatten the scale. Lets a client read a value as a position in the catalogue (and score a vehicle per category) rather than as a bare number. */
            ranges: {
                [key: string]: components["schemas"]["specRange"];
            };
        };
        TankSearchChunk: unknown;
        TankSearchResponse: {
            results: components["schemas"]["TankSummary"][];
        };
        /** @description Server-wide performance for a tank, averaged over tracked players. moeN/momN are holder counts among tracked players; null until the by-tank cron has coverage. */
        TankServerStats: {
            players: number;
            avg_battles: number;
            total_battles: number | null;
            avg_damage: number;
            winrate: number;
            player_wr: number | null;
            wn7: number | null;
            wn8: number | null;
            wnx: number | null;
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
        /** @description A change to one spec field (the tank_specs column name) between two game versions, with the raw before/after values. */
        TankSpecChange: {
            field: string;
            previous: number | null;
            next: number | null;
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
        tankVideo: {
            id: number;
            videoId: string;
            /** @description Where the battle starts in the video, in seconds. */
            startSeconds: number;
            title: string;
            channelName: string;
            mapName: string | null;
            mapSlug: string | null;
            mode: components["schemas"]["mapModeField"] | null;
            /** @description Side the player spawned from, derived from the map's own geometry rather than declared. */
            direction: components["schemas"]["spawnDirectionField"] | null;
            directionLabel: string | null;
            result: components["schemas"]["battleResultField"] | null;
            format: components["schemas"]["battleFormatField"];
            /** @description Players per team, from the format where it fixes one and from the submitter otherwise. */
            teamSize: number | null;
            /** @description Tier the battle was fought at, on the same rule as team size. */
            tier: number | null;
            /** @description Clan the battle was played for, resolved from a stored id so a rename cannot strand the credit. */
            clan: {
                /**
                 * @description Game server region.
                 * @enum {string}
                 */
                region: "eu" | "na" | "asia";
                id: number;
                tag: string;
                name: string;
                /** @description The clan's own colour, which its tag is rendered in. */
                color: string | null;
                /** @description The clan's emblem, drawn beside its tag. */
                emblem: string | null;
            } | null;
            /** @description Damage dealt plus assisted, as declared. Only ever set on a random battle. */
            combinedDamage: number | null;
            /** @description Client version at the time the video was approved. */
            gameVersion: string | null;
        };
        TankVideosResponse: {
            videos: components["schemas"]["tankVideo"][];
        };
        teamMarkers: {
            team1: components["schemas"]["mapMarker"][];
            team2: components["schemas"]["mapMarker"][];
        };
        tier: {
            name: string;
            image: string;
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
            /** @description Only on the Common Test client, not yet released. */
            isCommonTest: boolean;
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
        videoBattle: {
            id: number;
            videoId: string;
            /** @description Where the battle starts in the video, in seconds. */
            startSeconds: number;
            title: string;
            channelName: string;
            mapName: string | null;
            mapSlug: string | null;
            mode: components["schemas"]["mapModeField"] | null;
            /** @description Side the player spawned from, derived from the map's own geometry rather than declared. */
            direction: components["schemas"]["spawnDirectionField"] | null;
            directionLabel: string | null;
            result: components["schemas"]["battleResultField"] | null;
            format: components["schemas"]["battleFormatField"];
            /** @description Players per team, from the format where it fixes one and from the submitter otherwise. */
            teamSize: number | null;
            /** @description Tier the battle was fought at, on the same rule as team size. */
            tier: number | null;
            /** @description Clan the battle was played for, resolved from a stored id so a rename cannot strand the credit. */
            clan: {
                /**
                 * @description Game server region.
                 * @enum {string}
                 */
                region: "eu" | "na" | "asia";
                id: number;
                tag: string;
                name: string;
                /** @description The clan's own colour, which its tag is rendered in. */
                color: string | null;
                /** @description The clan's emblem, drawn beside its tag. */
                emblem: string | null;
            } | null;
            /** @description Damage dealt plus assisted, as declared. Only ever set on a random battle. */
            combinedDamage: number | null;
            /** @description Client version at the time the video was approved. */
            gameVersion: string | null;
        };
        videoBattleWithTank: {
            id: number;
            videoId: string;
            /** @description Where the battle starts in the video, in seconds. */
            startSeconds: number;
            title: string;
            channelName: string;
            mapName: string | null;
            mapSlug: string | null;
            mode: components["schemas"]["mapModeField"] | null;
            /** @description Side the player spawned from, derived from the map's own geometry rather than declared. */
            direction: components["schemas"]["spawnDirectionField"] | null;
            directionLabel: string | null;
            result: components["schemas"]["battleResultField"] | null;
            format: components["schemas"]["battleFormatField"];
            /** @description Players per team, from the format where it fixes one and from the submitter otherwise. */
            teamSize: number | null;
            /** @description Tier the battle was fought at, on the same rule as team size. */
            tier: number | null;
            /** @description Clan the battle was played for, resolved from a stored id so a rename cannot strand the credit. */
            clan: {
                /**
                 * @description Game server region.
                 * @enum {string}
                 */
                region: "eu" | "na" | "asia";
                id: number;
                tag: string;
                name: string;
                /** @description The clan's own colour, which its tag is rendered in. */
                color: string | null;
                /** @description The clan's emblem, drawn beside its tag. */
                emblem: string | null;
            } | null;
            /** @description Damage dealt plus assisted, as declared. Only ever set on a random battle. */
            combinedDamage: number | null;
            /** @description Client version at the time the video was approved. */
            gameVersion: string | null;
            tankId: number | null;
            tankName: string | null;
            tankSlug: string | null;
            tankShortName: string | null;
            tankTag: string | null;
            /** @description The vehicle's tier, as opposed to the battle's. */
            vehicleTier: number | null;
            nation: string | null;
            type: string | null;
            role: string | null;
            isPremium: boolean;
            isReward: boolean;
        };
        VideoSuggestBody: {
            /** @description YouTube link, timestamp included. */
            url: string;
            startSeconds?: number;
            arenaId: string;
            mode: components["schemas"]["mapModeField"];
            spawnTeam: number;
            result: components["schemas"]["battleResultField"];
            format: components["schemas"]["battleFormatField"];
            /** @description Vehicle the battle was played in, for a random battle. */
            tankSlug?: string;
            /** @description Damage dealt plus assisted, on a random battle. */
            combinedDamage?: number;
            teamSize?: number;
            tier?: number;
            /** @description Tag of the clan the battle was played for. */
            clanTag?: string;
        };
        VideoSuggestResponse: {
            ok: boolean;
        };
        /**
         * @description How well the voter plays, cut on account WN8 at the same boundaries the site paints its ratings with.
         * @enum {string}
         */
        voterBracketField: "unknown" | "learning" | "average" | "strong" | "unicum";
        voterProfile: {
            wn8: number | null;
            battles: number | null;
            bracket: components["schemas"]["voterBracketField"];
        };
        voterRecord: {
            battles: number;
            winrate: number | null;
            avgDamage: number | null;
            /** @description Their WN8 on this tank, not on their account. */
            tankWn8: number | null;
            marksOnGun: number | null;
            markOfMastery: number | null;
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
    "get-{region}-players-onslaught": {
        parameters: {
            query?: {
                /** @description Maximum number of rows to return. Out-of-range values are clamped. */
                limit?: number;
                /** @description Season event id to load (default the current season). From the seasons list in the response. */
                season?: string;
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
                    "application/json": components["schemas"]["OnslaughtResponse"];
                };
            };
        };
    };
    "get-{region}-players-steel-hunter": {
        parameters: {
            query?: {
                /** @description Maximum number of rows to return. Out-of-range values are clamped. */
                limit?: number;
                /** @description Ranking column (default hr). */
                sort?: "hr" | "hrb" | "battles" | "winrate" | "survival" | "damage";
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
                    "application/json": components["schemas"]["SteelHunterResponse"];
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
    "get-{region}-players-{nickname}-achievements": {
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
                    "application/json": components["schemas"]["PlayerAchievementsResponse"];
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
    "get-{region}-players-{nickname}-sessions": {
        parameters: {
            query: {
                /** @description Bucket size for the sessions. */
                granularity: "daily" | "weekly" | "monthly";
            };
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
                    "application/json": components["schemas"]["PlayerSessions"];
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
    "get-{region}-players-{nickname}-tanks-{slug}": {
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
                    "application/json": components["schemas"]["PlayerTankDetail"];
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
                sort?: "sr" | "srb" | "elo" | "battles" | "winrate";
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
    "get-{region}-clans-{tag}-videos": {
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
                    "application/json": components["schemas"]["ClanVideosResponse"];
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
    "get-{region}-ratings-mine": {
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
                    "application/json": components["schemas"]["OwnRatingsResponse"];
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
    "get-{region}-tanks-changes": {
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
                    "application/json": components["schemas"]["TankChangesResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-compare": {
        parameters: {
            query: {
                /** @description Vehicle slugs to compare (2 to 4). */
                slugs: string[];
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
                    "application/json": components["schemas"]["TanksCompare"];
                };
            };
        };
    };
    "get-{region}-tanks-ratings": {
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
                    "application/json": components["schemas"]["TankRatingBoardResponse"];
                };
            };
        };
    };
    "get-{region}-videos": {
        parameters: {
            query?: {
                /** @description Narrow to one video's battles, ordered by timestamp. */
                videoId?: string;
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
                    "application/json": components["schemas"]["CommunityVideosResponse"];
                };
            };
        };
    };
    "get-{region}-videos-mine": {
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
                    "application/json": components["schemas"]["MyVideosResponse"];
                };
            };
        };
    };
    "post-{region}-videos-suggest": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VideoSuggestBody"];
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VideoSuggestResponse"];
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
            query?: {
                /** @description Which game client to read the vehicle's characteristics from. `ct` serves what the running Common Test build makes of it, so a tank can be inspected and configured the way the next update would ship it. Falls back to live when no test is running or when it leaves this vehicle alone. */
                client?: "live" | "ct";
            };
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
    "get-{region}-tanks-{slug}-history": {
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
                    "application/json": components["schemas"]["TankHistoryResponse"];
                };
            };
        };
    };
    "post-{region}-tanks-{slug}-rate": {
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
        requestBody?: {
            content: {
                "application/json": components["schemas"]["TankRateBody"];
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TankRateResponse"];
                };
            };
        };
    };
    "post-{region}-tanks-{slug}-rate-withdraw": {
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
                    "application/json": components["schemas"]["TankRateWithdrawResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-ratings": {
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
                    "application/json": components["schemas"]["TankRatingsResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-ratings-me": {
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
                    "application/json": components["schemas"]["TankRatingMeResponse"];
                };
            };
        };
    };
    "get-{region}-tanks-{slug}-videos": {
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
                    "application/json": components["schemas"]["TankVideosResponse"];
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
    "get-{region}-search-resolve": {
        parameters: {
            query?: {
                /** @description Account ids, comma separated. */
                players?: string;
                /** @description Clan ids, comma separated. */
                clans?: string;
                /** @description Vehicle ids, comma separated. */
                tanks?: string;
                /** @description Arena ids, comma separated. */
                maps?: string;
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
                    "application/json": components["schemas"]["SearchResolveResponse"];
                };
            };
        };
    };
    "post-feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["FeedbackBody"];
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackResponse"];
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
    "get-{region}-maps-search": {
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
                    "application/json": components["schemas"]["MapSearchResponse"];
                };
            };
        };
    };
    "get-{region}-maps-search-ndjson": {
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
                    "application/json": components["schemas"]["MapSearchChunk"];
                };
            };
        };
    };
    "get-{region}-maps": {
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
                    "application/json": components["schemas"]["MapsListResponse"];
                };
            };
        };
    };
    "get-{region}-maps-changes": {
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
                    "application/json": components["schemas"]["MapChangesResponse"];
                };
            };
        };
    };
    "get-glossary": {
        parameters: {
            query?: {
                category?: components["schemas"]["glossaryCategoryField"];
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
                    "application/json": components["schemas"]["GlossaryListResponse"];
                };
            };
        };
    };
    "get-glossary-anchors": {
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
                    "application/json": components["schemas"]["GlossaryAnchorsResponse"];
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
    "get-og-{region}-tanks-compare": {
        parameters: {
            query: {
                /** @description Vehicle slugs to compare (2 to 4). */
                slugs: string[];
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
    "get-{region}-maps-{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Map slug (e.g. prokhorovka).
                 * @example prokhorovka
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
                    "application/json": components["schemas"]["MapDetailResponse"];
                };
            };
        };
    };
    "get-{region}-maps-{slug}-history": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Map slug (e.g. prokhorovka).
                 * @example prokhorovka
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
                    "application/json": components["schemas"]["MapHistoryResponse"];
                };
            };
        };
    };
    "get-{region}-maps-{slug}-videos": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Map slug (e.g. prokhorovka).
                 * @example prokhorovka
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
                    "application/json": components["schemas"]["MapVideosResponse"];
                };
            };
        };
    };
    "get-glossary-{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /**
                 * @description Term slug, e.g. `wn8`.
                 * @example slug
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
                    "application/json": components["schemas"]["GlossaryTermResponse"];
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
    "get-og-{region}-maps-{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example eu */
                region: "eu" | "na" | "asia";
                /**
                 * @description Map slug (e.g. prokhorovka).
                 * @example prokhorovka
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
