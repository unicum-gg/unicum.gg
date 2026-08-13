import type { NextConfig } from "next";

export const images: NextConfig["images"] = {
  // Wargaming emblems live on regional portal hosts that some user ISPs
  // route badly to. Proxy them through next/image so users always fetch
  // from our origin (which can reach WG).
  remotePatterns: [
    { protocol: "https", hostname: "eu.wargaming.net", pathname: "/clans/**" },
    { protocol: "https", hostname: "na.wargaming.net", pathname: "/clans/**" },
    { protocol: "https", hostname: "asia.wargaming.net", pathname: "/clans/**" },
    { protocol: "https", hostname: "eu-wotp.wgcdn.co", pathname: "/**" },
    { protocol: "https", hostname: "na-wotp.wgcdn.co", pathname: "/**" },
    { protocol: "https", hostname: "sg-wotp.wgcdn.co", pathname: "/**" },
    // Encyclopedia vehicle renders (the big tank image for the tank page hero).
    { protocol: "https", hostname: "api.worldoftanks.eu", pathname: "/static/**" },
    { protocol: "https", hostname: "api.worldoftanks.com", pathname: "/static/**" },
    { protocol: "https", hostname: "api.worldoftanks.asia", pathname: "/static/**" },
    // Twitch live-stream thumbnails for the "streaming now" cards.
    { protocol: "https", hostname: "static-cdn.jtvnw.net", pathname: "/**" },
    // Game GUI assets (e.g. equipment grade overlays) from our wot.assets
    // mirror, so we don't commit copies of them into the repo.
    {
      protocol: "https",
      hostname: "raw.githubusercontent.com",
      pathname: "/unicum-gg/wot.assets/**",
    },
    // HD battle minimaps from our wot.maps mirror.
    {
      protocol: "https",
      hostname: "raw.githubusercontent.com",
      pathname: "/unicum-gg/wot.maps/**",
    },
    // YouTube thumbnails for the community video suggestions. Only the
    // thumbnail host, and only its `/vi/` path: the video ids are parsed and
    // validated before they are stored, so nothing else should ever be built
    // from user input.
    {
      protocol: "https",
      hostname: "i.ytimg.com",
      pathname: "/vi/**",
    },
  ],
  // Tank icons are SVGs served from the trusted WG CDN. Next/Image refuses
  // SVG sources by default; enabling this allows them through the optimizer
  // (so they get proxied via our origin like everything else). The strict
  // CSP + sandbox below prevents any inline script in the SVG from running.
  dangerouslyAllowSVG: true,
  contentDispositionType: "attachment",
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
};
