import {
  BATTLE_TYPE_LABEL,
  BattleType,
  STRONGHOLD_TIER_LABEL,
  StrongholdTier,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { TankTab, tankTabHref } from "@/components/tanks/list/tabs";
import { mapsTabHref } from "@/components/maps/list/tabs";

export type NavSectionId = "players" | "clans" | "tanks" | "maps";

export type NavLink = {
  /** Stable key, region-independent, used to attach a navbar icon. */
  id: string;
  label: string;
  href: string;
  /** One line shown under the label in the navbar dropdown card. */
  description: string;
};

export type NavSection = {
  id: NavSectionId;
  /** The nav label, e.g. "Players". */
  label: string;
  links: NavLink[];
};

/**
 * The one place the site's sections and their sub-pages are declared, so the
 * navbar dropdowns and the footer columns list the same set: a new board or tab
 * is added here once and shows in both. Regional like everything catalogue, the
 * links carrying the reader's server rather than always EU. The footer reads
 * only `label`/`href`; `id` and `description` are for the navbar cards.
 */
export function navSections(region: Region): NavSection[] {
  const tanks = ROUTES.TANKS(region);
  const maps = ROUTES.MAPS(region);
  return [
    {
      id: "players",
      label: "Players",
      links: [
        {
          id: "top-players",
          label: "Top players",
          href: ROUTES.PLAYERS(region),
          description: "All-time player leaderboard",
        },
        {
          id: "players-onslaught",
          label: "Onslaught",
          href: ROUTES.PLAYERS_ONSLAUGHT(region),
          description: "Ranked Onslaught ladder",
        },
        {
          id: "players-steel-hunter",
          label: "Steel Hunter",
          href: ROUTES.PLAYERS_STEEL_HUNTER(region),
          description: "Battle royale leaderboard",
        },
      ],
    },
    {
      id: "clans",
      label: "Clans",
      links: [
        {
          id: "top-clans",
          label: "Top clans",
          href: ROUTES.CLANS(region),
          description: "All-time clan leaderboard",
        },
        {
          id: "stronghold",
          label: "Stronghold",
          href: ROUTES.STRONGHOLD(region, StrongholdTier.T10),
          description: "Skirmishes ladder",
        },
        {
          id: "advances",
          label: STRONGHOLD_TIER_LABEL[StrongholdTier.Advances],
          href: ROUTES.STRONGHOLD(region, StrongholdTier.Advances),
          description: "Tier X 15v15 ranking",
        },
      ],
    },
    {
      id: "tanks",
      label: "Tanks",
      links: [
        {
          id: "tank-performances",
          label: "Performances",
          href: tankTabHref(tanks, TankTab.Performances),
          description: "Winrate and damage per tank",
        },
        {
          id: "tank-specs",
          label: "Specifications",
          href: tankTabHref(tanks, TankTab.Specifications),
          description: "Stats for every tank",
        },
        {
          id: "tank-economics",
          label: "Economics",
          href: tankTabHref(tanks, TankTab.Economics),
          description: "Credit and XP earners",
        },
        {
          id: "tank-moe",
          label: "Marks of Excellence",
          href: tankTabHref(tanks, TankTab.MarksOfExcellence),
          description: "Damage for each mark",
        },
        {
          id: "tank-mom",
          label: "Marks of Mastery",
          href: tankTabHref(tanks, TankTab.MarksOfMastery),
          description: "Mastery badge thresholds",
        },
        {
          id: "tank-changes",
          label: "Changes",
          href: ROUTES.TANKS_CHANGES(region),
          description: "Buffs and nerfs by update",
        },
        {
          id: "tank-community",
          label: "Community ratings",
          href: ROUTES.TANKS_COMMUNITY(region),
          description: "Rated by players who own them",
        },
        {
          id: "tank-videos",
          label: "Videos",
          href: tankTabHref(tanks, TankTab.Videos),
          description: "Community gameplay",
        },
      ],
    },
    {
      id: "maps",
      label: "Maps",
      links: [
        {
          id: "all-maps",
          label: "All maps",
          href: maps,
          description: "Every map in the game",
        },
        ...[
          { type: BattleType.Random, id: "maps-random" },
          { type: BattleType.Frontline, id: "maps-frontline" },
          { type: BattleType.Onslaught, id: "maps-onslaught" },
          { type: BattleType.OnslaughtNight, id: "maps-onslaught-night" },
          { type: BattleType.GrandBattle, id: "maps-grand-battle" },
          { type: BattleType.ClanWars, id: "maps-clan-wars" },
        ].map(({ type, id }) => ({
          id,
          label: BATTLE_TYPE_LABEL[type],
          href: mapsTabHref(maps, type),
          description: `${BATTLE_TYPE_LABEL[type]} maps`,
        })),
        {
          id: "map-changes",
          label: "Changes",
          href: ROUTES.MAPS_CHANGES(region),
          description: "Map reworks by update",
        },
      ],
    },
  ];
}
