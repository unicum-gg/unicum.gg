// Pure, framework-free tab definitions shared by the server page (which renders
// the active section/mode) and the client nav. Kept out of the "use client"
// `tabs-nav.tsx` so these stay callable from Server Components.
//
// The profile has two nav axes, but they don't multiply: a mode is only
// reachable from Overview, so every reachable state is a single URL segment.
//
//   /eu/players/Animal                Overview + Random Battles (the default)
//   /eu/players/Animal/skirmish       Overview + Skirmish
//   /eu/players/Animal/cw-x           Overview + Clan Wars X
//   /eu/players/Animal/tanks          Tanks
//   /eu/players/Animal/achievements   Achievements
//   /eu/players/Animal/value          Value
//
// They used to be `?section=` / `?tab=` query params, which meant one indexable
// page per player instead of one per mode, and metadata frozen on whatever the
// page was loaded with (Next never re-renders on a `pushState`).
export enum PlayerSection {
  Overview = "overview",
  Tanks = "tanks",
  Value = "value",
  Achievements = "achievements",
}

export enum PlayerMode {
  Overall = "overall",
  Skirmish = "skirmish",
  Advances = "advances",
  GrandBattles = "grand",
  RankedBattles = "ranked",
  ClanWarsX = "cw-x",
  ClanWarsVIII = "cw-viii",
  ClanWarsVI = "cw-vi",
  SteelHunter = "steel-hunter",
}

/** A reachable (section, mode) pair, and the segment that addresses it. The
 * default pair lives at the bare player path, hence the null segment. */
export type PlayerView = {
  section: PlayerSection;
  mode: PlayerMode;
  segment: string | null;
  label: string;
};

const MODE_VIEWS: PlayerView[] = [
  [PlayerMode.Overall, null, "Random Battles"],
  [PlayerMode.Skirmish, "skirmish", "Skirmish"],
  [PlayerMode.Advances, "advances", "Advances"],
  [PlayerMode.GrandBattles, "grand", "Grand Battles"],
  [PlayerMode.RankedBattles, "ranked", "Ranked Battles"],
  [PlayerMode.ClanWarsX, "cw-x", "Clan Wars X"],
  [PlayerMode.ClanWarsVIII, "cw-viii", "Clan Wars VIII"],
  [PlayerMode.ClanWarsVI, "cw-vi", "Clan Wars VI"],
  [PlayerMode.SteelHunter, "steel-hunter", "Steel Hunter"],
].map(([mode, segment, label]) => ({
  section: PlayerSection.Overview,
  mode: mode as PlayerMode,
  segment: segment as string | null,
  label: label as string,
}));

export const PLAYER_VIEWS: PlayerView[] = [
  ...MODE_VIEWS,
  {
    section: PlayerSection.Tanks,
    mode: PlayerMode.Overall,
    segment: "tanks",
    label: "Tanks",
  },
  {
    section: PlayerSection.Achievements,
    mode: PlayerMode.Overall,
    segment: "achievements",
    label: "Achievements",
  },
  {
    section: PlayerSection.Value,
    mode: PlayerMode.Overall,
    segment: "value",
    label: "Value",
  },
];

/** Sections in top-row order. */
export const PLAYER_SECTIONS: { id: PlayerSection; label: string }[] = [
  { id: PlayerSection.Overview, label: "Overview" },
  { id: PlayerSection.Tanks, label: "Tanks" },
  { id: PlayerSection.Achievements, label: "Achievements" },
  { id: PlayerSection.Value, label: "Value" },
];

/** Modes in bottom-row order (only shown under Overview). */
export const PLAYER_MODES = MODE_VIEWS.map((v) => ({
  id: v.mode,
  label: v.label,
}));

/** The view at the bare player path: Overview, Random Battles. */
export const DEFAULT_PLAYER_VIEW: PlayerView = MODE_VIEWS[0];

function hrefFor(basePath: string, view: PlayerView): string {
  return view.segment ? `${basePath}/${view.segment}` : basePath;
}

/** This view's URL, given the player's base path. */
export function playerViewHref(basePath: string, view: PlayerView): string {
  return hrefFor(basePath, view);
}

/** The view a route segment addresses, or null when it is not one of ours (a
 * `/vs/` comparison, or a typo). */
export function playerViewFromSegment(
  segment: string | undefined,
): PlayerView | null {
  return PLAYER_VIEWS.find((v) => v.segment === (segment ?? null)) ?? null;
}

/** Switching section lands on that section's default mode: with one segment per
 * reachable state, Overview always means Random Battles. */
export function playerSectionHref(
  basePath: string,
  section: PlayerSection,
): string {
  const view = PLAYER_VIEWS.find((v) => v.section === section);
  return view ? hrefFor(basePath, view) : basePath;
}

/** A mode is only reachable from Overview, so selecting one always lands
 * there. */
export function playerModeHref(basePath: string, mode: PlayerMode): string {
  const view = MODE_VIEWS.find((v) => v.mode === mode);
  return view ? hrefFor(basePath, view) : basePath;
}
