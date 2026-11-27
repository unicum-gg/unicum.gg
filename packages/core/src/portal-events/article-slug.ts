/** A Wargaming portal of any region: links elsewhere (TikTok, Twitch) are not
 * articles, and the editors link across regions (Asia entries to `.eu`). */
export const isPortalLink = (url: URL) =>
  /(^|\.)worldoftanks\.(eu|com|asia)$/.test(url.hostname);

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
  let url: URL;
  try {
    url = new URL(linkOrPath, "https://worldoftanks.eu");
  } catch {
    return null;
  }
  if (!isPortalLink(url)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments.at(-1);
  // Only news articles: a Tankopedia page names no entry. And not the editors'
  // `/news/updates/PLACEHOLDER/`, which every unwritten article would share.
  if (!segments.includes("news") || !slug || slug.toLowerCase() === "placeholder") return null;
  return slug;
}
