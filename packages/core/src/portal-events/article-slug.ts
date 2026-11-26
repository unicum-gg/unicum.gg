/**
 * The article a calendar entry points at, by the last segment of its path
 * (`wci-finals-2026`), which is what tells the two sources' copies of one entry
 * apart from every other.
 *
 * Not the whole path: Wargaming files one article under more than one section,
 * and the two calendars do not agree on which. The WCI 2026 playoffs were
 * `/news/live-streams/wci-finals-2026/` in the home widget and
 * `/news/competitive-gaming/wci-finals-2026/` in the monthly article, which
 * published them twice on Discord until this compared the slug. The language
 * segment and the host fall away with the rest.
 */
export function articleSlug(linkOrPath: string | null): string | null {
  if (!linkOrPath) return null;
  let pathname: string;
  try {
    pathname = new URL(linkOrPath, "https://worldoftanks.eu").pathname;
  } catch {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean);
  // Only news articles: a Tankopedia page or a Twitch channel names no entry.
  return segments.includes("news") ? (segments.at(-1) ?? null) : null;
}
