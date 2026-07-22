// Pure, framework-free tab definitions shared by the server page (which reads
// the active section/mode from the URL) and the client nav/view. Kept out of
// the "use client" `tabs-nav.tsx` so these stay callable from Server Components.
//
// The player profile has two independent nav axes, each with its own query
// param so they don't clobber each other:
//   - section (top row): `?section=tanks` (Overview is the default, omitted).
//   - mode    (bottom row, only under Overview): `?tab=skirmish` (Random
//     Battles is the default, omitted).
export enum PlayerSection {
  Overview = "overview",
  Tanks = "tanks",
  Value = "value",
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

export const PLAYER_SECTIONS: {
  id: PlayerSection;
  label: string;
  query: string | null;
}[] = [
  { id: PlayerSection.Overview, label: "Overview", query: null },
  { id: PlayerSection.Tanks, label: "Tanks", query: "tanks" },
  { id: PlayerSection.Value, label: "Value", query: "value" },
];

export const PLAYER_MODES: {
  id: PlayerMode;
  label: string;
  query: string | null;
}[] = [
  { id: PlayerMode.Overall, label: "Random Battles", query: null },
  { id: PlayerMode.Skirmish, label: "Skirmish", query: "skirmish" },
  { id: PlayerMode.Advances, label: "Advances", query: "advances" },
  { id: PlayerMode.GrandBattles, label: "Grand Battles", query: "grand" },
  { id: PlayerMode.RankedBattles, label: "Ranked Battles", query: "ranked" },
  { id: PlayerMode.ClanWarsX, label: "Clan Wars X", query: "cw-x" },
  { id: PlayerMode.ClanWarsVIII, label: "Clan Wars VIII", query: "cw-viii" },
  { id: PlayerMode.ClanWarsVI, label: "Clan Wars VI", query: "cw-vi" },
  { id: PlayerMode.SteelHunter, label: "Steel Hunter", query: "steel-hunter" },
];

export function sectionFromQuery(
  query: string | null | undefined,
): PlayerSection {
  const found = PLAYER_SECTIONS.find((s) => s.query === query);
  return found ? found.id : PlayerSection.Overview;
}

export function modeFromQuery(query: string | null | undefined): PlayerMode {
  const found = PLAYER_MODES.find((m) => m.query === query);
  return found ? found.id : PlayerMode.Overall;
}

function buildHref(
  basePath: string,
  section: PlayerSection,
  mode: PlayerMode,
): string {
  const params = new URLSearchParams();
  const sectionQuery = PLAYER_SECTIONS.find((s) => s.id === section)?.query;
  const modeQuery = PLAYER_MODES.find((m) => m.id === mode)?.query;
  if (sectionQuery) params.set("section", sectionQuery);
  if (modeQuery) params.set("tab", modeQuery);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Section switch keeps the current mode, so toggling to Tanks and back returns
// to the mode you were reading.
export function playerSectionHref(
  basePath: string,
  section: PlayerSection,
  mode: PlayerMode,
): string {
  return buildHref(basePath, section, mode);
}

// A mode is only reachable from the Overview section, so selecting one always
// lands in Overview.
export function playerModeHref(basePath: string, mode: PlayerMode): string {
  return buildHref(basePath, PlayerSection.Overview, mode);
}
