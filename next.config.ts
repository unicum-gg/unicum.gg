import { execSync } from "node:child_process";
import type { NextConfig } from "next";

import "./env";

// Stable build identifier across container restarts of the same git revision.
// Used by both `generateBuildId` (asset path namespace) and `deploymentId`
// (Next.js version-skew protection). Same revision → same id → Cloudflare
// can cache static assets safely across rolling deploys; client prefetches
// from an old deploy that hit a new server get a 404 + auto-recover via the
// x-deployment-id mismatch handling.
function gitRevision(): string | undefined {
  if (process.env.DEPLOYMENT_ID) return process.env.DEPLOYMENT_ID;
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const BUILD_ID = gitRevision();

const nextConfig: NextConfig = {
  ...(BUILD_ID
    ? {
        generateBuildId: async () => BUILD_ID,
        deploymentId: BUILD_ID,
      }
    : {}),
  images: {
    // Wargaming emblems live on regional portal hosts that some user ISPs
    // route badly to. Proxy them through next/image so users always fetch
    // from our origin (which can reach WG).
    remotePatterns: [
      { protocol: "https", hostname: "eu.wargaming.net", pathname: "/clans/**" },
      { protocol: "https", hostname: "na.wargaming.net", pathname: "/clans/**" },
      { protocol: "https", hostname: "asia.wargaming.net", pathname: "/clans/**" },
      { protocol: "https", hostname: "eu-wotp.wgcdn.co", pathname: "/dcont/**" },
      { protocol: "https", hostname: "na-wotp.wgcdn.co", pathname: "/dcont/**" },
      { protocol: "https", hostname: "sg-wotp.wgcdn.co", pathname: "/dcont/**" },
    ],
  },
  // Map the `sitemap-N.xml` / `clans-sitemap-N.xml` / `players-sitemap-N.xml`
  // URLs declared in the sitemap index to their backing `[id]` route handlers.
  async rewrites() {
    return [
      { source: "/sitemap-:id.xml", destination: "/sitemap.xml/:id" },
      {
        source: "/:region(eu|na|asia)/clans-sitemap-:id.xml",
        destination: "/:region/clans-sitemap.xml/:id",
      },
      {
        source: "/:region(eu|na|asia)/players-sitemap-:id.xml",
        destination: "/:region/players-sitemap.xml/:id",
      },
    ];
  },
};

export default nextConfig;
