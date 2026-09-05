import type { NextConfig } from "next";

export const images: NextConfig["images"] = {
  // Wargaming emblems live on regional portal hosts that some user ISPs
  // route badly to. Proxy them through next/image so users always fetch
  // from our origin (which can reach WG).
  remotePatterns: [
    { protocol: "https", hostname: "eu.wargaming.net", pathname: "/clans/**" },
    { protocol: "https", hostname: "na.wargaming.net", pathname: "/clans/**" },
    { protocol: "https", hostname: "asia.wargaming.net", pathname: "/clans/**" },
    // Tournament logos. The tournament system's CDN names its regions
    // inconsistently (`tmswot-eu-` against `tms-static-na`), so all three are
    // listed as they actually appear in the mirrored rows rather than guessed
    // from a pattern.
    { protocol: "https", hostname: "tmswot-eu-static.gcdn.co", pathname: "/**" },
    { protocol: "https", hostname: "tms-static-na.gcdn.co", pathname: "/**" },
    { protocol: "https", hostname: "tms-static-asia.gcdn.co", pathname: "/**" },
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
  // Keep an optimized variant for 30 days instead of the 4h default.
  //
  // This is a floor, not a hint: the optimizer computes
  // `Math.max(upstreamRevalidate, minimumCacheTTL)`, so it overrides whatever
  // the source host asked for. At 4h every variant expired six times a day and
  // Cloudflare came back to revalidate, on an origin whose CPU is already spent
  // on crawler traffic. Almost everything above is immutable in practice (our
  // own versioned mirrors, encyclopedia renders), so re-deriving them on a
  // clock served no one. It is 30 days and not a year only because clan
  // emblems can legitimately change, and that is the one source here that
  // should eventually catch up on its own. Twitch stream thumbnails, the one
  // genuinely volatile source, render `unoptimized` and never reach this cache.
  minimumCacheTTL: 2592000,
  // Bound the on-disk variant cache. Left unset, Next sizes the LRU at HALF of
  // the free disk, which on this host is how the ISR cache once filled the
  // volume and took the database down with it. The longer TTL above makes the
  // working set grow (one entry per source image, width and quality), so the
  // ceiling has to be explicit rather than inherited from free space. Note the
  // LRU is per process and the PM2 workers share one directory: each reads the
  // existing entries at boot but not the others' later writes, so treat this as
  // a per-worker budget that the cluster can drift above, not a hard cap.
  maximumDiskCacheSize: 1024 * 1024 * 1024,

  // Tank icons are SVGs served from the trusted WG CDN. Next/Image refuses
  // SVG sources by default; enabling this allows them through the optimizer
  // (so they get proxied via our origin like everything else). The strict
  // CSP + sandbox below prevents any inline script in the SVG from running.
  dangerouslyAllowSVG: true,
  contentDispositionType: "attachment",
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
};
