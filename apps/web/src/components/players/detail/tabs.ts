import { PlayerMode, PLAYER_MODE_LABEL } from "./modes";

export { PlayerMode, PLAYER_MODE_LABEL };

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
//   /eu/players/Animal/sessions       Sessions
//   /eu/players/Animal/achievements   Achievements
//   /eu/players/Animal/steel-hunter   Overview + Steel Hunter
//   /eu/players/Animal/onslaught      Overview + Onslaught
//   /eu/players/Animal/tournaments    Tournaments
//   /eu/players/Animal/value          Value
//
// They used to be `?section=` / `?tab=` query params, which meant one indexable
// page per player instead of one per mode, and metadata frozen on whatever the
// page was loaded with (Next never re-renders on a `pushState`).
export enum PlayerSection {
  Overview = "overview",
  Tanks = "tanks",
  Sessions = "sessions",
  Value = "value",
  Achievements = "achievements",
  Tournaments = "tournaments",
}


/** A reachable (section, mode) pair, and the segment that addresses it. The
 * default pair lives at the bare player path, hence the null segment. */
export type PlayerView = {
  section: PlayerSection;
  mode: PlayerMode;
  segment: string | null;
  label: string;
};


const MODE_SEGMENT: Record<PlayerMode, string | null> = {
  [PlayerMode.Overall]: null,
  [PlayerMode.Skirmish]: "skirmish",
  [PlayerMode.Advances]: "advances",
  [PlayerMode.GrandBattles]: "grand",
  [PlayerMode.RankedBattles]: "ranked",
  [PlayerMode.ClanWarsX]: "cw-x",
  [PlayerMode.ClanWarsVIII]: "cw-viii",
  [PlayerMode.ClanWarsVI]: "cw-vi",
  [PlayerMode.SteelHunter]: "steel-hunter",
  [PlayerMode.Onslaught]: "onslaught",
  [PlayerMode.ClanBattles]: "clan",
  [PlayerMode.TankCompany]: "company",
  [PlayerMode.TeamBattles]: "team",
  [PlayerMode.PermanentTeams]: "permanent-teams",
  [PlayerMode.Historical]: "historical",
};

/**
 * The modes that are offered to everybody.
 *
 * The rest are finished: `account/info` still answers their totals, but nobody
 * can add to them, so a tab saying "no data yet, check back" would be a lie. A
 * player who played one gets its tab, everyone else never sees it. Same rule as
 * the map page's History tab, and the same reason.
 */
export const ARCHIVED_PLAYER_MODES: PlayerMode[] = [
  PlayerMode.ClanBattles,
  PlayerMode.TankCompany,
  PlayerMode.TeamBattles,
  PlayerMode.PermanentTeams,
  PlayerMode.Historical,
];

const ARCHIVED_MODES = new Set<PlayerMode>(ARCHIVED_PLAYER_MODES);

/** Whether this mode is only shown to an account that has a record in it. */
export function isArchivedPlayerMode(mode: PlayerMode): boolean {
  return ARCHIVED_MODES.has(mode);
}

const MODE_VIEWS: PlayerView[] = (
  Object.keys(PLAYER_MODE_LABEL) as PlayerMode[]
).map((mode) => ({
  section: PlayerSection.Overview,
  mode,
  segment: MODE_SEGMENT[mode],
  label: PLAYER_MODE_LABEL[mode],
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
    section: PlayerSection.Sessions,
    mode: PlayerMode.Overall,
    segment: "sessions",
    label: "Sessions",
  },
  {
    section: PlayerSection.Achievements,
    mode: PlayerMode.Overall,
    segment: "achievements",
    label: "Achievements",
  },
  {
    section: PlayerSection.Tournaments,
    mode: PlayerMode.Overall,
    segment: "tournaments",
    label: "Tournaments",
  },
  {
    section: PlayerSection.Value,
    mode: PlayerMode.Overall,
    segment: "value",
    label: "Value",
  },
];

/** Sections in top-row order. Ids only: the nav reads their wording from
 * `components/players/detail/tabs`. The battle MODES keep their labels here,
 * because those are Wargaming's own names for a game mode and the game shows
 * them to the player in their language already. */
export const PLAYER_SECTIONS: PlayerSection[] = [
  PlayerSection.Overview,
  PlayerSection.Tanks,
  PlayerSection.Sessions,
  PlayerSection.Achievements,
  PlayerSection.Tournaments,
  PlayerSection.Value,
];

/** Modes in bottom-row order (only shown under Overview). */
export const PLAYER_MODES = MODE_VIEWS.map((v) => ({
  id: v.mode,
  label: v.label,
}));

/**
 * The modes every account is offered, which is what a skeleton can know.
 *
 * Whether an ended mode appears depends on the payload, and a skeleton has
 * none: painting all fifteen would flash five tabs that vanish on hydration,
 * on the longest row on the site.
 */
export const ALWAYS_SHOWN_PLAYER_MODES = PLAYER_MODES.filter(
  (m) => !isArchivedPlayerMode(m.id),
);

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
