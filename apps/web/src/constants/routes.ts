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
  AUTH_SIGN_IN: (region: Region, callbackURL?: string) =>
    pathcat(
      "/api/auth/sign-in/wargaming",
      callbackURL ? { region, callbackURL } : { region },
    ),

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

  // - Players
  PLAYERS: (region: Region) =>
    region === Region.EU ? "/players" : pathcat("/:region/players", { region }),
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
  COMPARE_PLAYERS: (region: Region, [first, ...rest]: string[]) =>
    pathcat("/:region/players/:first/vs/:rest", {
      region,
      first,
      rest: rest.map(encodeURIComponent).join("/"),
    }),

  // - Clans
  CLAN: (region: Region, tag: string) =>
    pathcat("/:region/clans/:tag", { region, tag }),
  COMPARE_CLANS: (region: Region, [first, ...rest]: string[]) =>
    pathcat("/:region/clans/:first/vs/:rest", {
      region,
      first,
      rest: rest.map(encodeURIComponent).join("/"),
    }),
  CLANS: (region: Region) =>
    region === Region.EU ? "/clans" : pathcat("/:region/clans", { region }),

  // - Tanks (per region, with an EU shortcut at /tanks/:slug)
  TANK: (region: Region, slug: string) =>
    region === Region.EU
      ? pathcat("/tanks/:slug", { slug })
      : pathcat("/:region/tanks/:slug", { region, slug }),
  TANKS: (region: Region) =>
    region === Region.EU ? "/tanks" : pathcat("/:region/tanks", { region }),
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
