import pkg from "../../package.json";

const APP = {
  NAME: pkg.name,
  VERSION: pkg.version,
  DESCRIPTION:
    "Free World of Tanks stats for every player and clan across EU, NA and Asia. WN8, WNX, winrate, tank progression, clan member rankings and history.",
  URL: "https://unicum.gg",
  LOGO: "https://unicum.gg/icon.svg",
  EXTERNAL: {
    DISCORD: "https://discord.gg/pxSQgmzPTG",
    GITHUB: "https://github.com/unicum-gg/unicum.gg",
  },
};

/**
 * Identified User-Agent for outbound HTTP requests so upstream services
 * (Wargaming, G-Core CDN, tomato.gg) see a clearly named client instead of
 * a generic `node`/`curl` signature. Including the region helps debug
 * per-region rate limits.
 */
export function userAgent(region?: string): string {
  return region
    ? `${APP.NAME}/${region}/${APP.VERSION}`
    : `${APP.NAME}/${APP.VERSION}`;
}

export default APP;
