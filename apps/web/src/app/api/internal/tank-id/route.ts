import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";
import { NextResponse } from "next/server";
import ROUTES from "@/constants/routes";
import { localizePath } from "@/lib/translations";

export const dynamic = "force-dynamic";

/** `/{region}/tanks/{id}` and `/{region}/tanks/{id}/{tab}`, either form with a
 * locale prefix. The id is digits only, which is what the proxy matched on. */
const NUMERIC_TANK = /^(?:\/([a-z]{2}(?:-[a-z]{2})?))?\/(eu|na|asia)\/tanks\/(\d+)(\/[a-z-]+)?$/;

/**
 * Sends a numeric tank URL to its readable slug, carrying the query string.
 *
 * The redirect used to live in the page, where it could not see the query: the
 * six tank tabs are `force-static`, and a static page is handed an empty
 * `searchParams` by construction, so reading one to copy it would have turned
 * the site's most visited pages dynamic. A route handler has no such rule,
 * which is why `proxy.ts` rewrites here instead, the same move it makes for
 * `?page=N` and for `sitemap-3.xml`.
 *
 * The whole query is copied rather than a list of `utm_*`. It costs no more,
 * and the parameter nobody has thought of yet travels without this file being
 * touched again.
 *
 * Reached for every numeric URL, with a query or without one. It was scoped to
 * the ones carrying a query at first, leaving the page's own redirect in charge
 * of the rest; the page is `force-static`, so that redirect is cached with the
 * render that made it and a single failed resolve is served for half an hour
 * afterwards. This handler is `force-dynamic` and resolves the id every time,
 * which is why it now takes them all. See `proxy.ts` for the measurements.
 *
 * Numeric URLs are what the World of Tanks mod links to, and deliberately so:
 * the client knows a vehicle's id and nothing that yields our slug. The slug is
 * built from the ENGLISH `short_name`, while the client has localized names,
 * and a slug gains an id suffix when two vehicles collide (`is-7-5137`), which
 * takes the region's whole catalogue to know about. The id never moves.
 */
export async function GET(req: Request) {
  const original = req.headers.get("x-pathname") ?? "";
  const match = NUMERIC_TANK.exec(original);
  if (!match) return NextResponse.json({ error: "not_a_tank_id" }, { status: 400 });

  const [, pathLocale, region, id, tab] = match;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }

  // No vehicle answers to that id: a guessed or stale address, and nothing
  // useful can be redirected to. A route handler cannot render the site's own
  // 404 page, so it says the status and no more. That is the one thing lost by
  // taking every numeric URL rather than only the ones with a query, and it is
  // worth less than serving a cached 404 for every vehicle the mod links to.
  const slug = await getTankSlug(region, Number(id));
  if (!slug) return new Response(null, { status: 404 });

  const path = `${ROUTES.TANK(region, slug)}${tab ?? ""}`;
  const search = new URL(req.url).search;
  const target = (pathLocale ? localizePath(path, pathLocale) : path) + search;

  // A RELATIVE `Location`, which HTTP allows and every browser follows, rather
  // than an absolute URL built from `req.url`. This handler is reached through
  // a rewrite, so `req.url` carries whatever host the server is bound to, not
  // the one the reader asked for: behind the CDN that is an internal address,
  // and the redirect would send them nowhere.
  //
  // 308 rather than 301, matching what the page's own redirect claimed, and it
  // preserves the method.
  return new Response(null, { status: 308, headers: { Location: target } });
}
