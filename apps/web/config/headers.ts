import type { NextConfig } from "next";

import { AGENT_DISCOVERY_LINK } from "../src/constants/agent-discovery";

/**
 * What a cross-origin reader is allowed, on the public read routes.
 *
 * `*` and not a list of origins, because the data behind these routes is
 * public by design and a list would be a fiction: an origin header is sent by
 * the caller and anyone can send any value. The honest statement is that these
 * answers may be read by anybody, which is already true of anyone holding the
 * URL.
 *
 * No `Allow-Credentials`, and that pairs with `*` deliberately: a browser
 * refuses the combination, and these routes read nothing from a session, so a
 * cookie must never ride along with a cross-origin call to them.
 *
 * `Allow-Headers` is kept narrow. GET and HEAD only, since nothing here
 * writes, and the preflight answer is cached for a day so a client that asks
 * does not ask again on every call.
 */
const CORS = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "content-type, accept" },
  { key: "Access-Control-Max-Age", value: "86400" },
  // Caches keyed on the URL alone would otherwise be able to serve one
  // origin's answer to another; these answers do not vary by origin, but
  // saying so costs nothing and keeps a future narrowing honest.
  { key: "Vary", value: "Origin" },
];

export const headers: NextConfig["headers"] = async () => [
  // Advertise discovery on every page (and route), not just the homepage.
  // Excludes Next internals/assets under `_next/`, and the Markdown twins:
  // a header set here REPLACES the handler's own `Link`, and theirs carries
  // the canonical pointing back at the HTML page. They re-advertise
  // discovery themselves, from the same constant (`agentDiscoveryLink`).
  {
    source: "/((?!_next/|api/md/)(?!.*\\.md$).*)",
    headers: [{ key: "Link", value: AGENT_DISCOVERY_LINK }],
  },

  // The public read API, readable by a script on any page.
  //
  // These routes are already public and unauthenticated -- the docs call them
  // "the public read API the site and the SDK use", and anyone with the URL
  // gets the same answer. What they were missing is the one header that tells
  // a BROWSER its script may look at the answer: without it the request still
  // goes out and still returns 200, and the engine then hands the script an
  // empty body. That is not a safeguard, it is a silent failure, and it is
  // exactly what stopped the game's own post-battle screen from reading us.
  //
  // Scoped to the read routes on purpose. `api/game` (the mod's uploads),
  // `api/internal`, `api/cron`, `api/auth`, `api/account`, `api/connect`,
  // `api/link` and `api/disconnect` are left alone: they either write, carry a
  // token, or act on a signed-in session, and none of them has any business
  // being called from another origin.
  // One entry per region rather than a pattern with alternatives: the matcher
  // behind `source` has changed syntax between major Next versions, and three
  // plain lines cannot be broken by that.
  { source: "/api/eu/:path*", headers: CORS },
  { source: "/api/na/:path*", headers: CORS },
  { source: "/api/asia/:path*", headers: CORS },
  {
    source: "/api/openapi.json",
    headers: CORS,
  },
  {
    source: "/api/glossary/:path*",
    headers: CORS,
  },
  {
    source: "/api/models/:path*",
    headers: CORS,
  },
  {
    source: "/api/health",
    headers: CORS,
  },
];
