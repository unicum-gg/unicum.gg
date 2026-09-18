import { APP_IDENTITY } from "@unicum.gg/shared";
import { env } from "../../env";
import pkg from "../../package.json";

const APP = {
  NAME: "unicum.gg",
  VERSION: pkg.version,
  DESCRIPTION:
    "Free World of Tanks stats for every player, clan and tank across EU, NA and Asia. WN8, WNX, winrate, tank progression, clan member rankings and history.",
  URL: env.NEXT_PUBLIC_APP_URL,
  LOGO: `${env.NEXT_PUBLIC_APP_URL}/icon.svg`,
  CONTACT: {
    EMAIL: "contact@unicum.gg",
  },
  EXTERNAL: {
    DISCORD: "https://discord.gg/Hqbfb8YPbU",
    GITHUB: `https://github.com/${APP_IDENTITY.REPO}`,
    STATUS: "https://status.unicum.gg/",
    // The mod's page on Wargaming's mod hub, where the player downloads it.
    MOD_DOWNLOAD: "https://wgmods.net/7928",
    MOD_SOURCE: "https://github.com/unicum-gg/unicum.gg-mod",
    // Optional, and the only other mod the install steps name: it is what
    // draws the in-game settings window several mods share.
    MODS_SETTINGS_API: "https://github.com/izeberg/modssettingsapi",
  },
};

export default APP;
