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
  PLAYER: (region: Region, nickname: string) =>
    pathcat("/:region/players/:nickname", { region, nickname }),
  COMPARE_PLAYERS: (region: Region, nicknames: string[]) => {
    const [first, ...rest] = nicknames;
    const encoded = rest.map(encodeURIComponent).join("/");
    return `/${region}/players/${encodeURIComponent(first)}/vs/${encoded}`;
  },

  // - Clans
  CLAN: (region: Region, tag: string) =>
    pathcat("/:region/clans/:tag", { region, tag }),
};

export default ROUTES;
