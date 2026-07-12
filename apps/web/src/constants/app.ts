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
    GITHUB: "https://github.com/unicum-gg/unicum.gg",
  },
};

export default APP;
