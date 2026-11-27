import { BattleType, EVENT_ARENAS, slugifyMapName } from "@unicum.gg/shared";
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
 * The event arenas folded onto the map they replay, derived rather than listed.
 *
 * Until its pack was read, an event's arena was a card of its own named after
 * its raw id (`/maps/114-czech-fortrush-26` for Black Signal on Pilsen), so
 * that slug may have been crawled. Generated from the same table that folds the
 * arena (`EVENT_ARENAS`), so the next event's arenas redirect without a line
 * added here. The base map's slug is its English name's, which is the arena's
 * own name by construction: an arena only folds when it is called what its map
 * is called.
 */
function eventVariantRedirects(): [string, string, string][] {
  return Object.entries(EVENT_ARENAS).flatMap(([id, arena]) =>
    arena.baseId && arena.battleType
      ? [[slugifyMapName(id), slugifyMapName(arena.name), arena.battleType]]
      : [],
  );
}

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
  ...eventVariantRedirects(),
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

/**
 * The retired arenas taken off the gallery for having neither a name nor a
 * minimap: event battlefields of 0.9.8 to 1.18 that only the decompiled client
 * describes, carded under their raw id over an empty square for a day. Nothing
 * replaces them, so each lands on the gallery rather than on a 404, in the
 * reader's language: these redirects run before the proxy strips the prefix.
 */
const unlistedRetiredMapRedirects = [
  "102-race", "108-normandy-se20", "111-paris", "112-eiffel-tower",
  "116-himmelball", "117-canyon-ish", "119-lostcityball", "119-moon-pool",
  "119-turning-point-if", "120-kharkiv-halloween", "120-moscowball",
  "122-frozen-land", "122-somme", "123-dalny-gg", "125-highground-v",
  "126-asia-ravine-ish", "130-anykey-if", "132-abruzzo", "136-kassel",
].flatMap((slug) =>
  ["", "/:locale([a-z]{2})"].flatMap((prefix) => {
    const to = prefix ? "/:locale" : "";
    return [
      {
        source: `${prefix}/:region(eu|na|asia)/maps/${slug}/:tab*`,
        destination: `${to}/:region/maps`,
        permanent: true,
      },
      { source: `${prefix}/maps/${slug}/:tab*`, destination: `${to}/maps`, permanent: true },
    ];
  }),
);

/**
 * The Steel Hunter rename.
 *
 * The board, the profile tab and the endpoint were published as Steel Hunter
 * and read `statistics.fallout`, which is the 2015 Rampage event and a
 * different mode: Wargaming publishes no Steel Hunter statistics at all. Every
 * one of these was a live, indexed, linkable URL, and the two glossary slugs
 * went with the ratings they named (HR became MR, and HRB became MRB before
 * that column was withdrawn, see `mrbRemovalRedirects`), so each old address
 * keeps its readers rather than 404ing on a correction they had no part in.
 */
const rampageRenameRedirects = [
  ["/players/steel-hunter", "/players/rampage"],
  ["/:region(eu|na|asia)/players/steel-hunter", "/:region/players/rampage"],
  [
    "/:region(eu|na|asia)/players/:nickname/steel-hunter",
    "/:region/players/:nickname/rampage",
  ],
  // The public API path. A 404 would be louder, but an SDK caller following a
  // redirect keeps reading every field they already read: `hr` was renamed to
  // `mr`, and `hrb`/`mrb` has since been withdrawn (see
  // `mrbRemovalRedirects`), which no redirect can soften.
  [
    "/api/:region(eu|na|asia)/players/steel-hunter",
    "/api/:region/players/rampage",
  ],
  ["/glossary/hr", "/glossary/mr"],
  ["/glossary/hrb", "/glossary/mr"],
].map(([source, destination]) => ({ source, destination, permanent: true }));

/**
 * The MRB withdrawal.
 *
 * MRB was MR with the battle brake replaced by a volume reward, published as a
 * sortable column on the Rampage board. It came off because it was measured
 * against the two columns it sat between and found to be a blend of them rather
 * than an axis of its own: on EU its top 100 shares 56 rows with MR's and 58
 * with a plain sort by battles, and at the very top it disagreed with MR loudly
 * enough to contradict it (a player at the mode's exact median effectiveness
 * ranked 10th on MRB and 140th on MR, while the best average XP in the top of
 * the board ranked 5th on MR and 118th on MRB). Two neighbouring columns under
 * two colour ladders told a reader opposite things with nothing to say which to
 * believe.
 *
 * The glossary entry was indexed and is the only URL the withdrawal strands, so
 * it lands on MR, which is the rating the board still publishes.
 */
const mrbRemovalRedirects = [["/glossary/mrb", "/glossary/mr"]].map(
  ([source, destination]) => ({ source, destination, permanent: true }),
);

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
  ...unlistedRetiredMapRedirects,
  ...rampageRenameRedirects,
  ...mrbRemovalRedirects,
  // Creator vanity URLs (`/remi`) are deliberately NOT here any more. They are
  // served by `proxy.ts`, which is the only place they can be counted: Next
  // runs these redirects before the proxy, so an entry here means the proxy
  // never sees the path. See `@unicum.gg/core/partners`.
];
