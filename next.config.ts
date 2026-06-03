import type { NextConfig } from "next";

import "./env";

const nextConfig: NextConfig = {
  images: {
    // Wargaming emblems live on regional portal hosts that some user ISPs
    // route badly to. Proxy them through next/image so users always fetch
    // from our origin (which can reach WG).
    remotePatterns: [
      { protocol: "https", hostname: "eu.wargaming.net", pathname: "/clans/**" },
      { protocol: "https", hostname: "na.wargaming.net", pathname: "/clans/**" },
      { protocol: "https", hostname: "asia.wargaming.net", pathname: "/clans/**" },
    ],
  },
};

export default nextConfig;
