import { pathcat } from "pathcat";
import { StrongholdTier } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";

const ROUTES = {
  NONE: "#",
  INDEX: "/",

  // - API reference (region-less)
  DOCS: "/docs",

  // - Discord bot landing page
  BOT: "/bot",

  // - MCP server landing page
  MCP: "/mcp",

  // - Auth: Wargaming.net ID sign-in. The region rides as a query param (WG
  //   rejects a query string on the callback path, not on this start URL).
  //   `callbackURL` is the same-origin path to land on once logged in (e.g.
  //   `/api/connect/twitch` to chain straight into linking Twitch).
  //   Built with URLSearchParams rather than `pathcat` like the rest of this
  //   file, because `pathcat` concatenates query values verbatim: a
  //   `callbackURL` carrying its own query (`/eu/maps/x?view=onslaught`) would
  //   spill its params into ours, truncating the destination at the second `?`
  //   and, if one of them happened to be named `region`, overriding the region
  //   the player just picked in the login modal.
  AUTH_SIGN_IN: (region: Region, callbackURL?: string) => {
    const query = new URLSearchParams({ region });
    if (callbackURL) query.set("callbackURL", callbackURL);
    return `/api/auth/sign-in/wargaming?${query.toString()}`;
  },

  // - Home
  HOME: (region: Region) =>
    region === Region.EU ? "/" : pathcat("/:region", { region }),

  // - Coverage (per region)
  COVERAGE: (region: Region) =>
    region === Region.EU
      ? "/coverage"
      : pathcat("/:region/coverage", { region }),

  // - Support (region-less)
  SUPPORT: "/support",

  // - Glossary (region-less by design: a definition reads the same on every
  //   server, so one URL per term rather than three of the same page).
  GLOSSARY: "/glossary",
  GLOSSARY_TERM: (slug: string) => pathcat("/glossary/:slug", { slug }),
  GLOSSARY_CATEGORY: (category: string) =>
    pathcat("/glossary/category/:category", { category }),

  // - Players
  PLAYERS: (region: Region) =>
    region === Region.EU ? "/players" : pathcat("/:region/players", { region }),
  PLAYERS_STEEL_HUNTER: (region: Region) =>
    region === Region.EU
      ? "/players/steel-hunter"
      : pathcat("/:region/players/steel-hunter", { region }),
  PLAYERS_ONSLAUGHT: (region: Region) =>
    region === Region.EU
      ? "/players/onslaught"
      : pathcat("/:region/players/onslaught", { region }),
  PLAYERS_BY_LANGUAGE: (
    region: Region,
    language: string,
    strict: boolean = false,
  ) => {
    const base =
      region === Region.EU
        ? pathcat("/players/lang/:language", { language })
        : pathcat("/:region/players/lang/:language", { region, language });
    return strict ? `${base}/strict` : base;
  },
  PLAYER: (region: Region, nickname: string) =>
    pathcat("/:region/players/:nickname", { region, nickname }),
  // A player's Steel Hunter tab, so the SH leaderboard links straight to the
  // matching mode instead of the overview.
  PLAYER_STEEL_HUNTER: (region: Region, nickname: string) =>
    pathcat("/:region/players/:nickname/steel-hunter", { region, nickname }),
  // A player's Tournaments tab, where the winner's crest sends a reader: the
  // crest says they have won, this is the record of what.
  PLAYER_TOURNAMENTS: (region: Region, nickname: string) =>
    pathcat("/:region/players/:nickname/tournaments", { region, nickname }),
  // A clan's Tournaments tab, the target of its own winner's crest.
  CLAN_TOURNAMENTS: (region: Region, tag: string) =>
    pathcat("/:region/clans/:tag/tournaments", { region, tag }),
  // One player's record on one vehicle, the game's Service Record. A URL of its
  // own rather than a panel state, so it can be linked, shared and reopened.
  PLAYER_TANK: (region: Region, nickname: string, slug: string) =>
    pathcat("/:region/players/:nickname/tanks/:slug", {
      region,
      nickname,
      slug,
    }),
  COMPARE_PLAYERS: (region: Region, [first, ...rest]: string[]) =>
    pathcat("/:region/players/:first/vs/:rest", {
      region,
      first,
      rest: rest.map(encodeURIComponent).join("/"),
    }),

  // - Clans
  CLAN: (region: Region, tag: string) =>
    pathcat("/:region/clans/:tag", { region, tag }),
  // A clan's Stronghold mode page, optionally anchored to one tier's section, so
  // the stronghold boards link straight to the matching tier on the clan page.
  CLAN_STRONGHOLD: (region: Region, tag: string, tier?: StrongholdTier) => {
    const base = pathcat("/:region/clans/:tag/stronghold", { region, tag });
    return tier ? `${base}#${tier}` : base;
  },
  COMPARE_CLANS: (region: Region, [first, ...rest]: string[]) =>
    pathcat("/:region/clans/:first/vs/:rest", {
      region,
      first,
      rest: rest.map(encodeURIComponent).join("/"),
    }),
  CLANS: (region: Region) =>
    region === Region.EU ? "/clans" : pathcat("/:region/clans", { region }),

  // - Tanks. The catalogue keeps its short URL (one page per region, and its
  //   tab segments hang off this path), but an individual vehicle always
  //   carries its region — like a player or a clan. A tank's numbers are
  //   per-region (server averages, MoE thresholds, top players), so `/tanks/is-7`
  //   silently meant "the EU one" and served a second URL for the same page.
  //   `proxy.ts` redirects the region-less form onto the visitor's region.
  TANK: (region: Region, slug: string) =>
    pathcat("/:region/tanks/:slug", { region, slug }),
  // Vehicles side by side, the game's Compare Vehicles screen. Same shape as the
  // player and clan comparisons: the first vehicle owns the path, the rest hang
  // off `/vs`. Each column's build rides in the `setup` query param.
  COMPARE_TANKS: (region: Region, [first, ...rest]: string[]) =>
    pathcat("/:region/tanks/:first/vs/:rest", {
      region,
      first,
      rest: rest.map(encodeURIComponent).join("/"),
    }),
  TANKS: (region: Region) =>
    region === Region.EU ? "/tanks" : pathcat("/:region/tanks", { region }),
  TANKS_CHANGES: (region: Region) =>
    region === Region.EU
      ? "/tanks/changes"
      : pathcat("/:region/tanks/changes", { region }),
  // The community board. Sits directly under /tanks rather than under the
  // /tanks/all tab root, because it is not a view of the stats table: it is a
  // page about what players say, and its own landing.
  TANKS_COMMUNITY: (region: Region) =>
    region === Region.EU
      ? "/tanks/community"
      : pathcat("/:region/tanks/community", { region }),

  // - Maps. Same split as tanks: catalogue short, item regional. A map's
  //   geometry is worldwide, but the Clan Wars pool it belongs to is not.
  MAP: (region: Region, slug: string) =>
    pathcat("/:region/maps/:slug", { region, slug }),
  MAPS: (region: Region) =>
    region === Region.EU ? "/maps" : pathcat("/:region/maps", { region }),
  MAPS_CHANGES: (region: Region) =>
    region === Region.EU
      ? "/maps/changes"
      : pathcat("/:region/maps/changes", { region }),

  // - Servers. The game's clusters and their population, which is a property of
  //   the region rather than of the game, so it is regional all the way down.
  SERVERS: (region: Region) =>
    region === Region.EU ? "/servers" : pathcat("/:region/servers", { region }),

  // - Tournaments. Regional throughout: a tournament is run on one realm and
  //   its teams are that realm's accounts, so there is no worldwide view to
  //   shorten the EU path to.
  TOURNAMENT: (region: Region, id: number | string) =>
    pathcat("/:region/tournaments/:id", { region, id: String(id) }),
  TOURNAMENTS: (region: Region) =>
    pathcat("/:region/tournaments", { region }),
  // `team` singular, mirroring the path Wargaming addresses a tournament team
  // on, so a habit from their site lands somewhere familiar.
  TOURNAMENT_TEAM: (region: Region, id: number | string, teamId: number | string) =>
    pathcat("/:region/tournaments/:id/team/:teamId", {
      region,
      id: String(id),
      teamId: String(teamId),
    }),
  STRONGHOLD: (region: Region, tier?: StrongholdTier) => {
    const base =
      region === Region.EU
        ? "/clans/stronghold"
        : pathcat("/:region/clans/stronghold", { region });
    return tier ? `${base}/${tier}` : base;
  },
  CLANS_BY_LANGUAGE: (
    region: Region,
    language: string,
    strict: boolean = false,
  ) => {
    const base =
      region === Region.EU
        ? pathcat("/clans/lang/:language", { language })
        : pathcat("/:region/clans/lang/:language", { region, language });
    return strict ? `${base}/strict` : base;
  },
};

export default ROUTES;
