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

// Advertise agent-discovery resources on the homepages via a Link header
// (RFC 8288 / RFC 9727 section 3). Relative URIs resolve against the request,
// so no domain is hard-coded.
const AGENT_DISCOVERY_LINK =
  '</.well-known/api-catalog>; rel="api-catalog", ' +
  '</api/openapi.json>; rel="service-desc", ' +
  '</docs>; rel="service-doc"';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them.
  transpilePackages: ["@unicum.gg/core", "@unicum.gg/wargaming"],
  // Local auth testing runs on `http://127.0.0.1:3000` because WG OpenID
  // rejects a `localhost` redirect_uri but accepts the loopback IP. The dev
  // server is initialised on `localhost`, so without this Next blocks the
  // cross-origin dev requests from 127.0.0.1 (HMR + client fetches never fire
  // and interactive widgets stay frozen on their SSR placeholder). Dev-only.
  allowedDevOrigins: ["127.0.0.1"],
  ...(BUILD_ID
    ? {
        generateBuildId: async () => BUILD_ID,
        deploymentId: BUILD_ID,
      }
    : {}),
  // The leaderboard pages prerender 3 metric variants per language at
  // build, each kicking off a ~2-5s heavy CTE chain on the EU dataset.
  // The 60s default trips on the largest languages (`ru`, `de`, `pl`)
  // when other workers are competing on the same Postgres pool.
  staticPageGenerationTimeout: 300,
  images: {
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
    ],
    // Tank icons are SVGs served from the trusted WG CDN. Next/Image refuses
    // SVG sources by default; enabling this allows them through the optimizer
    // (so they get proxied via our origin like everything else). The strict
    // CSP + sandbox below prevents any inline script in the SVG from running.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
  },
  // The sitemap index publishes pretty `<…>/sitemap-N.xml` URLs (file-like,
  // matches the sitemap convention). App Router can only use `[id]` as a
  // whole folder name, so the actual route handlers live under
  // `<…>/sitemap.xml/[id]/`. These rewrites bridge the two without forcing
  // the external URLs to look like `/.../sitemap.xml/0`.
  async rewrites() {
    return [
      { source: "/sitemap-:id.xml", destination: "/sitemap.xml/:id" },
      {
        source: "/:region(eu|na|asia)/clans/sitemap-:id.xml",
        destination: "/:region/clans/sitemap.xml/:id",
      },
      {
        source: "/:region(eu|na|asia)/players/sitemap-:id.xml",
        destination: "/:region/players/sitemap.xml/:id",
      },
      {
        source: "/:region(eu|na|asia)/tanks/sitemap-:id.xml",
        destination: "/:region/tanks/sitemap.xml/:id",
      },
    ];
  },
  // Browsers and crawlers default-request `/favicon.ico`, but we serve the
  // App Router `app/icon.svg` convention so that path is a 404. Permanent
  // redirect so caches stop asking.
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
    ];
  },
  async headers() {
    return [
      // Advertise discovery on every page (and route), not just the homepage.
      // Excludes Next internals/assets under `_next/`.
      {
        source: "/((?!_next/).*)",
        headers: [{ key: "Link", value: AGENT_DISCOVERY_LINK }],
      },
    ];
  },
};

export default nextConfig;
