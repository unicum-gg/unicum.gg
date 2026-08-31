import type { Region } from "@unicum.gg/wargaming";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { navSections } from "@/components/nav-sections";

export type FooterLink = {
  label: string;
  href: string;
  /** Opens in a new tab, and skips Next's prefetch (it leaves cross-origin
   * hrefs alone anyway). */
  external?: boolean;
};

export type FooterColumn = {
  title: string;
  links: FooterLink[];
};

/**
 * The footer's columns, built for the region the reader is browsing.
 *
 * The catalogue columns are derived from `navSections`, the same source the
 * navbar dropdowns read, so a board or tab added there shows in both. The
 * "Leaderboards" column recombines the player and clan sub-links the navbar
 * keeps apart, which is why it is composed here rather than being a fifth
 * section: it is a footer-only grouping.
 */
export function footerColumns(region: Region): FooterColumn[] {
  const sections = navSections(region);
  const players = sections.find((s) => s.id === "players")!;
  const clans = sections.find((s) => s.id === "clans")!;
  const tanks = sections.find((s) => s.id === "tanks")!;
  const maps = sections.find((s) => s.id === "maps")!;
  // A section holding a single page does not earn a column of its own, the same
  // rule the navbar applies to its dropdowns: a heading with one entry under it
  // reads as a column someone forgot to finish. Its link joins the first column,
  // which is already where the region's own pages live.
  const singlePage = sections
    .filter((s) => s.links.length === 1)
    .flatMap((s) => s.links);

  return [
    {
      title: "Leaderboards",
      links: [
        // The three landings first, then the mode-specific boards, so the
        // column reads "the tops" then "the rest" rather than by section.
        players.links[0], // Top players
        clans.links[0], // Top clans
        { label: "Top tanks", href: ROUTES.TANKS(region) },
        ...clans.links.slice(1), // Stronghold, Advances
        ...players.links.slice(1), // Onslaught, Steel Hunter
        ...singlePage, // Server population
      ],
    },
    { title: "Tanks", links: tanks.links },
    { title: "Maps", links: maps.links },
    {
      // The three ways to read our data without opening the site.
      title: "Integrations",
      links: [
        { label: "Discord bot", href: ROUTES.BOT },
        { label: "MCP server", href: ROUTES.MCP },
        { label: "API docs", href: ROUTES.DOCS },
      ],
    },
    {
      // What the site is rather than what it shows: how much of the playerbase
      // we track, who pays for it, where the code lives, whether it is up.
      title: "Project",
      links: [
        { label: "Glossary", href: ROUTES.GLOSSARY },
        { label: "Coverage", href: ROUTES.COVERAGE(region) },
        { label: "Support us", href: ROUTES.SUPPORT },
        { label: "Source code", href: APP.EXTERNAL.GITHUB, external: true },
        { label: "Status", href: APP.EXTERNAL.STATUS, external: true },
        { label: "Discord", href: APP.EXTERNAL.DISCORD, external: true },
      ],
    },
  ];
}
