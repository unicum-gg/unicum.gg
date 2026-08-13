import { execSync } from "node:child_process";
import type { NextConfig } from "next";

import "./env";
import { AGENT_DISCOVERY_LINK } from "./src/constants/agent-discovery";
// The tab definitions themselves, so the legacy-query redirects below list the
// segments that exist rather than a copy of them that can drift.
import { BattleType } from "@unicum.gg/shared";
import { CLAN_VIEWS } from "./src/components/clans/detail/tabs";
import { PLAYER_VIEWS } from "./src/components/players/detail/tabs";
import { TANK_DETAIL_TABS } from "./src/components/tanks/detail/tabs";
import { TANK_TABS } from "./src/components/tanks/list/tabs";

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
  // ISR / server cache handler. The default handler writes every generated page
  // to the container's local disk with no eviction, so the `force-static` player
  // and clan pages (on-demand over ~2M+ entities) grow it without bound and fill
  // the disk. Per the Next.js self-hosting guide, we swap in a Redis-backed
  // handler with a TTL eviction policy (see `cache-handler.js`) and disable the
  // in-memory LRU so every instance reads the same shared, bounded cache.
  cacheHandler: require.resolve("./cache-handler.js"),
  cacheMaxMemorySize: 0,
  // Allow a separate build output dir (e.g. running a prod `next start` on one
  // port while `next dev` uses the default `.next` on another). Defaults to
  // `.next`; override with NEXT_DIST_DIR for a side-by-side prod instance.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Workspace packages ship TypeScript source; Next transpiles them.
  transpilePackages: [
    "@unicum.gg/core",
    "@unicum.gg/shared",
    "@unicum.gg/sdk",
    "@unicum.gg/wargaming",
  ],
  // Local auth testing runs on `http://127.0.0.1:3000` because WG OpenID
  // rejects a `localhost` redirect_uri but accepts the loopback IP. The dev
  // server is initialised on `localhost`, so without this Next blocks the
  // cross-origin dev requests from 127.0.0.1 (HMR + client fetches never fire
  // and interactive widgets stay frozen on their SSR placeholder). Dev-only.
  allowedDevOrigins: ["127.0.0.1"],
  // Next streams metadata (`<title>`, canonical, og:*) into the body as React-19
  // hoistable elements and hoists them to `<head>` client-side, so a crawler
  // that doesn't run JS sees an empty `<head>`. `/.*/` is Next's documented way
  // to fully disable streaming metadata, so every request renders it blocking in
  // the `<head>`. ISR/prerendered pages (tanks, clans, home) already resolve
  // metadata at build and never streamed, so this only affects the pages still
  // rendered dynamically (player). The cost is minimal: generateMetadata shares
  // the page's memoized fetch, so the head flushes with it instead of before it.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots#disabling
  htmlLimitedBots: /.*/,
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
  experimental: {
    // Cap the build's worker pool.
    //
    // This defaults to `os.cpus().length - 1`, which on the 8-vCPU deploy host
    // opens 7 workers. Each is a full Node process that inherits the runtime's
    // 4 GiB V8 heap ceiling, and V8 paces its GC against that ceiling rather
    // than against what the machine has left, so the pool held 12 GiB of
    // private memory on a 22 GiB box that also runs the app, Postgres and
    // Redis. The kernel OOM-killed Postgres three times on 2026-08-06, twice
    // taking the build down with it (builds 11:43 and 12:20 both died within
    // 70s of a kill). Postgres was an innocent victim: it held 335 MiB of
    // private memory, but every backend maps the 2816 MB shared_buffers
    // segment, so the kernel scored each of them at ~2.8 GB.
    //
    // 4 keeps the box responsive while it builds, at the cost of a longer
    // static-generation phase. Note this is the only knob that works:
    // `staticGenerationMinPagesPerWorker` exists in the config schema but is
    // never read in 16.2.6 (verified: setting it left the pool untouched).
    cpus: 4,
    // Collapse the router's per-segment prefetch into one request per link.
    //
    // Next 16 splits every prefetch into a request per route segment (the tree,
    // the head, each layout, the page). Measured on /tanks, whose grid puts
    // dozens of links in the viewport, that is 97 requests and 6.8 MB of flight
    // payload on a single page view. Inlining bundles the small segments into
    // one response, so a link costs one round trip instead of three or four.
    // Ships default-off in 16.2 and default-on in 16.3.
    prefetchInlining: true,
  },
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
    // Tabs and filters that used to be query params are route segments now (so
    // a render builds one tab instead of all of them, and each is indexable).
    // These keep the old URLs working.
    //
    // Only the values that actually became a segment are matched, read from the
    // tab definitions themselves so a renamed tab is a change in its own enum
    // and never in this file. The first version of these rules captured any
    // value at all (`(?<tab>.+)`) and pasted it on as a segment, which meant
    // every URL the enums had moved on from stopped being a page: `?tab=vehicles`
    // (the Tanks section's name until June 2026) landed on `/clans/FAME/vehicles`
    // and 404ed, and so did the values naming a default view (`?tab=overview`,
    // `?tab=overall`, `?tab=specifications`), which have no segment to go to at
    // all. Anything unmatched now falls through to the page it was already
    // asking for, which renders, ignores the stale param, and points its
    // canonical at itself.
    //
    // Next always forwards the request's query to the destination (there is no
    // opt-out, and a trailing `?` does not strip it), so the landing URL keeps a
    // stale param. Harmless for the same reason, and it is also why a value can
    // never be redirected to the bare path: the param would survive the hop and
    // match the rule again, forever.
    //
    // A tab's legacy query value is the segment it became, so the table is the
    // list of segments a page has. Renames are the exception and are the reason
    // this is a map rather than a list: the clan Tanks section was labelled
    // Vehicles until June 2026, and `?tab=vehicles` is what a good part of the
    // clan pages are still indexed under.
    const segmentsOf = (
      tabs: { segment: string | null }[],
      renamed: Record<string, string> = {},
    ): Record<string, string> => ({
      ...Object.fromEntries(
        tabs.flatMap((t) => (t.segment ? [[t.segment, t.segment]] : [])),
      ),
      ...renamed,
    });

    const legacyQueryRedirects = (
      source: string,
      keys: string[],
      // `:segment` in the destination, e.g. `/:region/clans/:tag/:segment`.
      destination: string,
      segments: Record<string, string>,
    ) => {
      const entries = Object.entries(segments);
      // A value that still names its own segment rides a named capture, so the
      // common case is one rule per key rather than one per tab.
      const verbatim = entries.filter(([value, s]) => value === s);
      const renamed = entries.filter(([value, s]) => value !== s);
      return keys.flatMap((key) => [
        ...(verbatim.length > 0
          ? [
              {
                source,
                has: [
                  {
                    type: "query" as const,
                    key,
                    // Next anchors this (`^…$`), so the alternation is exact.
                    value: `(?<segment>${verbatim.map(([v]) => v).join("|")})`,
                  },
                ],
                destination,
                permanent: true,
              },
            ]
          : []),
        ...renamed.map(([value, segment]) => ({
          source,
          has: [{ type: "query" as const, key, value }],
          destination: destination.replace(":segment", segment),
          permanent: true,
        })),
      ]);
    };

    const segmentRedirects = [
      // Tank detail: `?tab=performances` → `/tanks/is-7/performances`.
      ...legacyQueryRedirects(
        "/:region(eu|na|asia)/tanks/:slug",
        ["tab"],
        "/:region/tanks/:slug/:segment",
        segmentsOf(TANK_DETAIL_TABS),
      ),
      ...legacyQueryRedirects(
        "/tanks/:slug",
        ["tab"],
        "/tanks/:slug/:segment",
        segmentsOf(TANK_DETAIL_TABS),
      ),
      // Tank index: `?tab=economics` → `/tanks/all/economics`. Under `/all` so a
      // tab can never collide with a vehicle slug.
      ...legacyQueryRedirects(
        "/:region(eu|na|asia)/tanks",
        ["tab"],
        "/:region/tanks/all/:segment",
        segmentsOf(TANK_TABS),
      ),
      ...legacyQueryRedirects(
        "/tanks",
        ["tab"],
        "/tanks/all/:segment",
        segmentsOf(TANK_TABS),
      ),
      // Map gallery: `?type=frontline` → `/maps/all/frontline`.
      ...legacyQueryRedirects(
        "/:region(eu|na|asia)/maps",
        ["type"],
        "/:region/maps/all/:segment",
        segmentsOf(Object.values(BattleType).map((t) => ({ segment: t }))),
      ),
      ...legacyQueryRedirects(
        "/maps",
        ["type"],
        "/maps/all/:segment",
        segmentsOf(Object.values(BattleType).map((t) => ({ segment: t }))),
      ),
      // Clan detail: `?tab=stronghold` → `/eu/clans/FAME/stronghold`, and
      // `?section=tanks` → `/eu/clans/FAME/tanks`. Two axes, but a mode is only
      // reachable from Overview, so each state is a single segment.
      ...legacyQueryRedirects(
        "/:region(eu|na|asia)/clans/:tag",
        ["tab", "section"],
        "/:region/clans/:tag/:segment",
        segmentsOf(CLAN_VIEWS, { vehicles: "tanks" }),
      ),
      // Player detail: same two axes, same single-segment states.
      ...legacyQueryRedirects(
        "/:region(eu|na|asia)/players/:nickname",
        ["tab", "section"],
        "/:region/players/:nickname/:segment",
        segmentsOf(PLAYER_VIEWS),
      ),
    ];

    return [
      ...segmentRedirects,
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
      // Legacy OG image path (the Next `opengraph-image` file convention, whose
      // URL got a route-group hash after the `(site)` move) → the stable
      // hash-free `/api/og` route. Keeps old embeds (Discord bot, shared links)
      // resolving without touching every caller.
      {
        source: "/:region(eu|na|asia)/players/:nickname/opengraph-image",
        destination: "/api/og/:region/players/:nickname",
        permanent: true,
      },
      {
        source: "/:region(eu|na|asia)/clans/:tag/opengraph-image",
        destination: "/api/og/:region/clans/:tag",
        permanent: true,
      },
      {
        source: "/:region(eu|na|asia)/tanks/:slug/opengraph-image",
        destination: "/api/og/:region/tanks/:slug",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Advertise discovery on every page (and route), not just the homepage.
      // Excludes Next internals/assets under `_next/`, and the Markdown twins:
      // a header set here REPLACES the handler's own `Link`, and theirs carries
      // the canonical pointing back at the HTML page. They re-advertise
      // discovery themselves, from the same constant (`agentDiscoveryLink`).
      {
        source: "/((?!_next/|api/md/)(?!.*\\.md$).*)",
        headers: [{ key: "Link", value: AGENT_DISCOVERY_LINK }],
      },
    ];
  },
};

export default nextConfig;
