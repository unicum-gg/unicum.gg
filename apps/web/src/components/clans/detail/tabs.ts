// Pure, framework-free clan tab definitions shared by the server page (which
// renders the active section/mode) and the client nav. Kept out of the
// "use client" `tabs-nav.tsx` so these stay callable from Server Components.
//
// The page has two nav axes, but they don't multiply: a mode is only reachable
// from Overview, so every reachable state is a single URL segment.
//
//   /eu/clans/FAME               Overview + Random Battles (the default)
//   /eu/clans/FAME/stronghold    Overview + Stronghold
//   /eu/clans/FAME/clan-wars     Overview + Clan Wars
//   /eu/clans/FAME/tanks         Tanks
//   /eu/clans/FAME/manage        Manage (a tool, kept out of the index)
//
// They used to be `?section=` / `?tab=` query params, which meant one indexable
// page per clan instead of one per mode, and metadata frozen on whatever the
// page was loaded with (Next never re-renders on a `pushState`).
export enum ClanSection {
  Overview = "overview",
  Tanks = "tanks",
  /** The tactics this clan is credited on, filed from the map pages. */
  Videos = "videos",
  // The Stronghold boost console. Visitors see a teaser; the controls only
  // render for officers of this clan, checked client-side.
  Manage = "manage",
}

export enum ClanMode {
  RandomBattles = "random",
  Stronghold = "stronghold",
  ClanWars = "clan-wars",
}

/** A reachable (section, mode) pair, and the segment that addresses it. The
 * default pair lives at the bare clan path, hence the null segment. */
export type ClanView = {
  section: ClanSection;
  mode: ClanMode;
  segment: string | null;
  label: string;
};

export const CLAN_VIEWS: ClanView[] = [
  {
    section: ClanSection.Overview,
    mode: ClanMode.RandomBattles,
    segment: null,
    label: "Random Battles",
  },
  {
    section: ClanSection.Overview,
    mode: ClanMode.Stronghold,
    segment: "stronghold",
    label: "Stronghold",
  },
  {
    section: ClanSection.Overview,
    mode: ClanMode.ClanWars,
    segment: "clan-wars",
    label: "Clan Wars",
  },
  {
    section: ClanSection.Tanks,
    mode: ClanMode.RandomBattles,
    segment: "tanks",
    label: "Tanks",
  },
  {
    section: ClanSection.Videos,
    mode: ClanMode.RandomBattles,
    segment: "videos",
    label: "Videos",
  },
  {
    section: ClanSection.Manage,
    mode: ClanMode.RandomBattles,
    segment: "manage",
    label: "Manage",
  },
];

/** Sections in top-row order, each pointing at the segment that opens it. */
export const CLAN_SECTIONS: { id: ClanSection; label: string }[] = [
  { id: ClanSection.Overview, label: "Overview" },
  { id: ClanSection.Tanks, label: "Tanks" },
  { id: ClanSection.Videos, label: "Videos" },
  { id: ClanSection.Manage, label: "Manage" },
];

/** Modes in bottom-row order (only shown under Overview). */
export const CLAN_MODES = CLAN_VIEWS.filter(
  (v) => v.section === ClanSection.Overview,
).map((v) => ({ id: v.mode, label: v.label }));

function hrefFor(basePath: string, view: ClanView): string {
  return view.segment ? `${basePath}/${view.segment}` : basePath;
}

/** The view at the bare clan path: Overview, Random Battles. */
export const DEFAULT_CLAN_VIEW: ClanView = CLAN_VIEWS[0];

/** The Manage view, for callers that link straight to it (the boost teaser's
 * login round-trip needs it as a return destination). */
export const MANAGE_CLAN_VIEW: ClanView = CLAN_VIEWS.find(
  (v) => v.section === ClanSection.Manage,
) as ClanView;

/** This view's URL, given the clan's base path. */
export function clanViewHref(basePath: string, view: ClanView): string {
  return hrefFor(basePath, view);
}

/** The view a route segment addresses, or null when it is not one of ours (a
 * `/vs/` comparison, or a typo). */
export function clanViewFromSegment(
  segment: string | undefined,
): ClanView | null {
  return CLAN_VIEWS.find((v) => v.segment === (segment ?? null)) ?? null;
}

/** Switching section lands on that section's default mode: with one segment per
 * reachable state, Overview always means Random Battles. */
export function clanSectionHref(basePath: string, section: ClanSection): string {
  const view = CLAN_VIEWS.find((v) => v.section === section);
  return view ? hrefFor(basePath, view) : basePath;
}

/** A mode is only reachable from Overview, so selecting one always lands
 * there. */
export function clanModeHref(basePath: string, mode: ClanMode): string {
  const view = CLAN_VIEWS.find(
    (v) => v.section === ClanSection.Overview && v.mode === mode,
  );
  return view ? hrefFor(basePath, view) : basePath;
}
