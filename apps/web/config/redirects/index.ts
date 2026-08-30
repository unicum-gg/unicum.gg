import { BattleType } from "@unicum.gg/shared";
import type { NextConfig } from "next";

// The tab definitions themselves, so the legacy-query rules below list the
// segments that exist rather than a copy of them that can drift.
import { CLAN_VIEWS } from "../../src/components/clans/detail/tabs";
import { PLAYER_VIEWS } from "../../src/components/players/detail/tabs";
import { TANK_DETAIL_TABS } from "../../src/components/tanks/detail/tabs";
import { TANK_TABS } from "../../src/components/tanks/list/tabs";
import { legacyQueryRedirects, segmentsOf } from "./legacy-query";

/** The map gallery filters by battle type, which is an enum rather than a tab
 * list, so it is shaped like one to go through the same builder. `all` is the
 * bare gallery and is absent from `BattleType` already. */
const MAP_TYPE_TABS = Object.values(BattleType).map((type) => ({
  segment: type,
}));

/**
 * The variant pages that were folded into their base map, as permanent
 * redirects onto the view that replaced them.
 *
 * Written out rather than derived: the catalogue no longer holds these slugs (it
 * is what dropped them), and a redirect table has to name what it redirects.
 * Each entry is a page that was live and indexed, so leaving it to 404 would be
 * the one real cost of the fold.
 */
const mapVariantRedirects = [
  ["steppes-waffentrager", "steppes", BattleType.Waffentrager],
  ["redshire-waffentrager", "redshire", BattleType.Waffentrager],
  ["siegfried-line-waffentrager", "siegfried-line", BattleType.Waffentrager],
  ["nordskar-last-stand", "nordskar", BattleType.LastStand],
  ["siegfried-line-last-stand", "siegfried-line", BattleType.LastStand],
  ["nordskar-story-mode", "nordskar", BattleType.StoryMode],
].flatMap(([from, to, view]) => [
  {
    source: `/:region(eu|na|asia)/maps/${from}`,
    destination: `/:region/maps/${to}?view=${view}`,
    permanent: true,
  },
  {
    source: `/maps/${from}`,
    destination: `/maps/${to}?view=${view}`,
    permanent: true,
  },
]);

export const redirects: NextConfig["redirects"] = async () => [
  // Tank detail: `?tab=performances` → `/tanks/is-7/performances`.
  ...legacyQueryRedirects({
    source: "/:region(eu|na|asia)/tanks/:slug",
    keys: ["tab"],
    destination: "/:region/tanks/:slug/:segment",
    segments: segmentsOf(TANK_DETAIL_TABS),
  }),
  ...legacyQueryRedirects({
    source: "/tanks/:slug",
    keys: ["tab"],
    destination: "/tanks/:slug/:segment",
    segments: segmentsOf(TANK_DETAIL_TABS),
  }),
  // Tank index: `?tab=economics` → `/tanks/all/economics`. Under `/all` so a
  // tab can never collide with a vehicle slug.
  ...legacyQueryRedirects({
    source: "/:region(eu|na|asia)/tanks",
    keys: ["tab"],
    destination: "/:region/tanks/all/:segment",
    segments: segmentsOf(TANK_TABS),
  }),
  ...legacyQueryRedirects({
    source: "/tanks",
    keys: ["tab"],
    destination: "/tanks/all/:segment",
    segments: segmentsOf(TANK_TABS),
  }),
  // Map gallery: `?type=frontline` → `/maps/all/frontline`.
  ...legacyQueryRedirects({
    source: "/:region(eu|na|asia)/maps",
    keys: ["type"],
    destination: "/:region/maps/all/:segment",
    segments: segmentsOf(MAP_TYPE_TABS),
  }),
  ...legacyQueryRedirects({
    source: "/maps",
    keys: ["type"],
    destination: "/maps/all/:segment",
    segments: segmentsOf(MAP_TYPE_TABS),
  }),
  // Clan detail: `?tab=stronghold` → `/eu/clans/FAME/stronghold`, and
  // `?section=tanks` → `/eu/clans/FAME/tanks`. Two axes, but a mode is only
  // reachable from Overview, so each state is a single segment.
  ...legacyQueryRedirects({
    source: "/:region(eu|na|asia)/clans/:tag",
    keys: ["tab", "section"],
    destination: "/:region/clans/:tag/:segment",
    segments: segmentsOf(CLAN_VIEWS, { vehicles: "tanks" }),
  }),
  // Player detail: same two axes, same single-segment states.
  ...legacyQueryRedirects({
    source: "/:region(eu|na|asia)/players/:nickname",
    keys: ["tab", "section"],
    destination: "/:region/players/:nickname/:segment",
    segments: segmentsOf(PLAYER_VIEWS),
  }),
  // Browsers and crawlers default-request `/favicon.ico`, but we serve the
  // App Router `app/icon.svg` convention so that path is a 404. Permanent
  // redirect so caches stop asking.
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
  // The map variants (Waffenträger, Last Stand, Story Mode) used to be cards of
  // their own, so `/maps/steppes-waffentrager` was a real page and is indexed as
  // one. They are views of their base map now, and the slug is gone with the
  // card, so each old URL keeps its readers by landing on the view it named.
  ...mapVariantRedirects,
];
