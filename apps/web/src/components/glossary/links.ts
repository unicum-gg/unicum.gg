import {
  GlossaryLinkTarget,
  StrongholdTier,
  type GlossaryLink,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { TankTab, tankTabHref } from "@/components/tanks/list/tabs";
import ROUTES from "@/constants/routes";

/**
 * Resolve a term's link to a path for the reader's region.
 *
 * Entries name a destination rather than spelling a path, because every
 * catalogue route carries a region and a definition is written once for all
 * three servers. This is where that name becomes a URL, next to the routes it
 * builds from, so a route that moves does not silently break the glossary.
 */
export function glossaryLinkHref(link: GlossaryLink, region: Region): string {
  const tanks = ROUTES.TANKS(region);
  switch (link.target) {
    case GlossaryLinkTarget.TopPlayers:
      return ROUTES.PLAYERS(region);
    case GlossaryLinkTarget.TopClans:
      return ROUTES.CLANS(region);
    case GlossaryLinkTarget.Tanks:
      return tanks;
    case GlossaryLinkTarget.TankEconomics:
      return tankTabHref(tanks, TankTab.Economics);
    case GlossaryLinkTarget.MarksOfExcellence:
      return tankTabHref(tanks, TankTab.MarksOfExcellence);
    case GlossaryLinkTarget.MarksOfMastery:
      return tankTabHref(tanks, TankTab.MarksOfMastery);
    case GlossaryLinkTarget.TankChanges:
      return ROUTES.TANKS_CHANGES(region);
    case GlossaryLinkTarget.Maps:
      return ROUTES.MAPS(region);
    case GlossaryLinkTarget.Stronghold:
      return ROUTES.STRONGHOLD(region, StrongholdTier.T10);
    case GlossaryLinkTarget.Advances:
      return ROUTES.STRONGHOLD(region, StrongholdTier.Advances);
    case GlossaryLinkTarget.Onslaught:
      return ROUTES.PLAYERS_ONSLAUGHT(region);
    case GlossaryLinkTarget.SteelHunter:
      return ROUTES.PLAYERS_STEEL_HUNTER(region);
    case GlossaryLinkTarget.Coverage:
      return ROUTES.COVERAGE(region);
    case GlossaryLinkTarget.Docs:
      return ROUTES.DOCS;
    case GlossaryLinkTarget.Tank:
      return ROUTES.TANK(region, link.slug ?? "");
    case GlossaryLinkTarget.Map:
      return ROUTES.MAP(region, link.slug ?? "");
  }
}

/** Default wording per destination, so an entry only writes a label when the
 * sentence needs something other than the obvious one. */
const LABEL: Record<GlossaryLinkTarget, string> = {
  [GlossaryLinkTarget.TopPlayers]: "Player leaderboard",
  [GlossaryLinkTarget.TopClans]: "Clan leaderboard",
  [GlossaryLinkTarget.Tanks]: "Every tank",
  [GlossaryLinkTarget.TankEconomics]: "Tank economics",
  [GlossaryLinkTarget.MarksOfExcellence]: "Marks of Excellence by tank",
  [GlossaryLinkTarget.MarksOfMastery]: "Mastery thresholds by tank",
  [GlossaryLinkTarget.TankChanges]: "Buffs and nerfs by update",
  [GlossaryLinkTarget.Maps]: "Every map",
  [GlossaryLinkTarget.Stronghold]: "Stronghold ladder",
  [GlossaryLinkTarget.Advances]: "Advances ranking",
  [GlossaryLinkTarget.Onslaught]: "Onslaught ladder",
  [GlossaryLinkTarget.SteelHunter]: "Steel Hunter leaderboard",
  [GlossaryLinkTarget.Coverage]: "Tracking coverage",
  [GlossaryLinkTarget.Docs]: "API reference",
  [GlossaryLinkTarget.Tank]: "This tank",
  [GlossaryLinkTarget.Map]: "This map",
};

export function glossaryLinkLabel(link: GlossaryLink): string {
  return link.label ?? LABEL[link.target];
}
