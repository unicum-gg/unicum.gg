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
    // The two announcement channels, opened in the client. Only a member sees
    // them, and a member is who can press Follow on one.
    DISCORD_TANK_CHANGES:
      "https://discord.com/channels/1512415714982625420/1574685257821847553",
    DISCORD_MAP_CHANGES:
      "https://discord.com/channels/1512415714982625420/1574685261865029652",
    GITHUB: `https://github.com/${APP_IDENTITY.REPO}`,
    STATUS: "https://status.unicum.gg/",
    // The mod's page on Wargaming's mod hub, where the player downloads it.
    MOD_DOWNLOAD: APP_IDENTITY.MOD_HUB_URL,
    MOD_SOURCE: "https://github.com/unicum-gg/unicum.gg-mod",
    // The same build, from the repository that publishes it first. Wargaming
    // reviews every submission before it appears on the hub (0.1.1 took six
    // days), so between a release and its approval the hub is the only place
    // the newest version is NOT, and a player who wants it has nowhere to go.
    MOD_RELEASES: "https://github.com/unicum-gg/unicum.gg-mod/releases/latest",
    // Optional, and the only other mod the install steps name: it is what
    // draws the in-game settings window several mods share.
    MODS_SETTINGS_API: "https://github.com/izeberg/modssettingsapi",
  },
};

export default APP;
