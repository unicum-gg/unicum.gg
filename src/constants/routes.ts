import { pathcat } from "pathcat";
import { Region } from "@/services/wargaming/wot";

const ROUTES = {
  NONE: "#",
  INDEX: "/",

  // - Home
  HOME: (region: Region) =>
    region === Region.EU ? "/" : pathcat("/:region", { region }),

  // - Players
  PLAYER: (region: Region, nickname: string) =>
    pathcat("/:region/players/:nickname", { region, nickname }),

  // - Clans
  CLAN: (region: Region, tag: string) =>
    pathcat("/:region/clans/:tag", { region, tag }),

  // - External
  EXTERNAL: {
    DISCORD: "https://discord.gg/pxSQgmzPTG",
    GITHUB: "https://github.com/unicum-gg/unicum.gg",
  },
};

export default ROUTES;
