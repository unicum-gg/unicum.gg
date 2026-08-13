import {
  BattleType,
  BATTLE_TYPE_LABEL,
  STRONGHOLD_TIER_LABEL,
  StrongholdTier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { TankTab, tankTabHref } from "@/components/tanks/list/tabs";
import { mapsTabHref } from "@/components/maps/list/tabs";

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
 * A function rather than a constant because every catalogue link is regional:
 * a tank's numbers are per-region, and so is a clan's ladder, so a footer that
 * always said EU sent a reader on NA to another server's leaderboard. The one
 * link that was already region-aware had to carry its own client component to
 * get there; now the whole footer does.
 */
export function footerColumns(region: Region): FooterColumn[] {
  const tanks = ROUTES.TANKS(region);
  const maps = ROUTES.MAPS(region);

  return [
    {
      title: "Leaderboards",
      links: [
        { label: "Top players", href: ROUTES.PLAYERS(region) },
        { label: "Top clans", href: ROUTES.CLANS(region) },
        { label: "Top tanks", href: tanks },
        // The two stronghold boards worth their own entry: skirmishes are the
        // ladder people compare on, Advances is a different mode entirely
        // (15v15) with its own ranking, and it is buried a tab deep otherwise.
        {
          label: "Stronghold",
          href: ROUTES.STRONGHOLD(region, StrongholdTier.T10),
        },
        {
          label: STRONGHOLD_TIER_LABEL[StrongholdTier.Advances],
          href: ROUTES.STRONGHOLD(region, StrongholdTier.Advances),
        },
      ],
    },
    {
      title: "Tanks",
      links: [
        {
          label: "Specifications",
          href: tankTabHref(tanks, TankTab.Specifications),
        },
        { label: "Economics", href: tankTabHref(tanks, TankTab.Economics) },
        {
          label: "Marks of Excellence",
          href: tankTabHref(tanks, TankTab.MarksOfExcellence),
        },
        {
          label: "Marks of Mastery",
          href: tankTabHref(tanks, TankTab.MarksOfMastery),
        },
        { label: "Videos", href: tankTabHref(tanks, TankTab.Videos) },
      ],
    },
    {
      title: "Maps",
      links: [
        { label: "All maps", href: maps },
        // The battle types a map belongs to are real pages of their own, and
        // "frontline maps" is a query people type, so they are worth a link
        // rather than a filter buried in the gallery.
        ...[
          BattleType.Random,
          BattleType.Frontline,
          BattleType.Onslaught,
          BattleType.GrandBattle,
          BattleType.ClanWars,
        ].map((type) => ({
          label: BATTLE_TYPE_LABEL[type],
          href: mapsTabHref(maps, type),
        })),
      ],
    },
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
      // we track, who pays for it, where the code lives.
      title: "Project",
      links: [
        { label: "Coverage", href: ROUTES.COVERAGE(region) },
        { label: "Support us", href: ROUTES.SUPPORT },
        { label: "Source code", href: APP.EXTERNAL.GITHUB, external: true },
        { label: "Discord", href: APP.EXTERNAL.DISCORD, external: true },
      ],
    },
  ];
}
