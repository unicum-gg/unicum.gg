import type { NextConfig } from "next";

import "./env";
import { buildId } from "./config/build-id";
import { experimental } from "./config/experimental";
import { headers } from "./config/headers";
import { images } from "./config/images";
import { redirects } from "./config/redirects";
import { rewrites } from "./config/rewrites";

const nextConfig: NextConfig = {
  // ISR / server cache handler. The default handler writes every generated page
  // to the container's local disk with no eviction, so the `force-static` player
  // and clan pages (on-demand over ~2M+ entities) grow it without bound and fill
  // the disk. Per the Next.js self-hosting guide, we swap in a Redis-backed
  // handler with a TTL eviction policy (see `config/cache-handler.js`) and
  // disable the in-memory LRU so every instance reads the same shared, bounded
  // cache.
  cacheHandler: require.resolve("./config/cache-handler.js"),
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
  ...buildId,
  // The leaderboard pages prerender 3 metric variants per language at
  // build, each kicking off a ~2-5s heavy CTE chain on the EU dataset.
  // The 60s default trips on the largest languages (`ru`, `de`, `pl`)
  // when other workers are competing on the same Postgres pool.
  staticPageGenerationTimeout: 300,
  experimental,
  images,
  rewrites,
  redirects,
  headers,
};

export default nextConfig;
