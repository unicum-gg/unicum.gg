// Pure, framework-free clan tab definitions shared by the server page (which
// reads the active section/mode from the URL) and the client nav/view. Kept out
// of the "use client" `tabs-nav.tsx` so these stay callable from Server
// Components.
//
// Like the player profile, the clan page has two independent nav axes, each
// with its own query param so they don't clobber each other:
//   - section (top row): `?section=tanks` (Overview is the default, omitted).
//   - mode    (bottom row, only under Overview): `?tab=stronghold` /
//     `?tab=clan-wars` (Random Battles is the default, omitted). Random Battles
//     is the members table, whose ratings are random-battles stats.
export enum ClanSection {
  Overview = "overview",
  Tanks = "tanks",
}

export enum ClanMode {
  RandomBattles = "random",
  Stronghold = "stronghold",
  ClanWars = "clan-wars",
}

export const CLAN_SECTIONS: {
  id: ClanSection;
  label: string;
  query: string | null;
}[] = [
  { id: ClanSection.Overview, label: "Overview", query: null },
  { id: ClanSection.Tanks, label: "Tanks", query: "tanks" },
];

export const CLAN_MODES: {
  id: ClanMode;
  label: string;
  query: string | null;
}[] = [
  { id: ClanMode.RandomBattles, label: "Random Battles", query: null },
  { id: ClanMode.Stronghold, label: "Stronghold", query: "stronghold" },
  { id: ClanMode.ClanWars, label: "Clan Wars", query: "clan-wars" },
];

export function sectionFromQuery(
  query: string | null | undefined,
): ClanSection {
  const found = CLAN_SECTIONS.find((s) => s.query === query);
  return found ? found.id : ClanSection.Overview;
}

export function modeFromQuery(query: string | null | undefined): ClanMode {
  const found = CLAN_MODES.find((m) => m.query === query);
  return found ? found.id : ClanMode.RandomBattles;
}

function buildHref(
  basePath: string,
  section: ClanSection,
  mode: ClanMode,
): string {
  const params = new URLSearchParams();
  const sectionQuery = CLAN_SECTIONS.find((s) => s.id === section)?.query;
  const modeQuery = CLAN_MODES.find((m) => m.id === mode)?.query;
  if (sectionQuery) params.set("section", sectionQuery);
  if (modeQuery) params.set("tab", modeQuery);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Section switch keeps the current mode, so toggling to Tanks and back returns
// to the mode you were reading.
export function clanSectionHref(
  basePath: string,
  section: ClanSection,
  mode: ClanMode,
): string {
  return buildHref(basePath, section, mode);
}

// A mode is only reachable from the Overview section, so selecting one always
// lands in Overview.
export function clanModeHref(basePath: string, mode: ClanMode): string {
  return buildHref(basePath, ClanSection.Overview, mode);
}
