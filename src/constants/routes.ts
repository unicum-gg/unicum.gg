import { pathcat } from "pathcat";
import { Region } from "@/services/wargaming/wot";

const ROUTES = {
  NONE: "#",
  INDEX: "/",

  // - Home
  HOME: (region: Region) =>
    region === Region.EU ? "/" : pathcat("/:region", { region }),

  // - Coverage (per region)
  COVERAGE: (region: Region) =>
    region === Region.EU
      ? "/coverage"
      : pathcat("/:region/coverage", { region }),

  // - Players
  PLAYERS: (region: Region) =>
    region === Region.EU ? "/players" : pathcat("/:region/players", { region }),
  PLAYERS_BY_LANGUAGE: (region: Region, language: string) =>
    region === Region.EU
      ? pathcat("/players/lang/:language", { language })
      : pathcat("/:region/players/lang/:language", { region, language }),
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
  CLANS_BY_LANGUAGE: (region: Region, language: string) =>
    region === Region.EU
      ? pathcat("/clans/lang/:language", { language })
      : pathcat("/:region/clans/lang/:language", { region, language }),
};

export default ROUTES;
