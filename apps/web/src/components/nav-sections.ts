import { BattleType, StrongholdTier } from "@unicum.gg/shared";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { TankTab, tankTabHref } from "@/components/tanks/list/tabs";
import { mapsTabHref } from "@/components/maps/list/tabs";
import { battleTypeName } from "@/components/game-name";

export type NavSectionId =
  | "players"
  | "clans"
  | "tanks"
  | "maps"
  | "tournaments"
  | "servers";

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
 *
 * Wording comes from `components/nav-sections`, keyed by the same stable `id`
 * the navbar icons are, so this file stays a pure, footer-safe data module and
 * the two consumers cannot end up naming a section differently. The labels it
 * `tGame` is `game/vocabulary`: the mode names are Wargaming's own words and
 * every language the game ships in has its own for them, so they are looked up
 * rather than written here (see `lib/game-vocabulary`).
 */
export function navSections(
  region: Region,
  t: TranslateFunction,
  tGame: TranslateFunction,
): NavSection[] {
  const tanks = ROUTES.TANKS(region);
  const maps = ROUTES.MAPS(region);
  return [
    {
      id: "players",
      label: t("sections.players"),
      links: [
        {
          id: "top-players",
          label: t("links.top-players.label"),
          href: ROUTES.PLAYERS(region),
          description: t("links.top-players.description"),
        },
        {
          id: "players-steel-hunter",
          label: tGame("player-modes.steel-hunter"),
          href: ROUTES.PLAYERS_STEEL_HUNTER(region),
          description: t("links.players-steel-hunter.description"),
        },
        {
          id: "players-onslaught",
          label: tGame("player-modes.onslaught"),
          href: ROUTES.PLAYERS_ONSLAUGHT(region),
          description: t("links.players-onslaught.description"),
        },
      ],
    },
    {
      id: "clans",
      label: t("sections.clans"),
      links: [
        {
          id: "top-clans",
          label: t("links.top-clans.label"),
          href: ROUTES.CLANS(region),
          description: t("links.top-clans.description"),
        },
        {
          id: "advances",
          label: tGame(`stronghold-tiers.${StrongholdTier.Advances}`),
          href: ROUTES.STRONGHOLD(region, StrongholdTier.Advances),
          description: t("links.advances.description"),
        },
        {
          id: "stronghold",
          label: tGame("features.stronghold"),
          href: ROUTES.STRONGHOLD(region, StrongholdTier.T10),
          description: t("links.stronghold.description"),
        },
      ],
    },
    {
      id: "tanks",
      label: t("sections.tanks"),
      links: [
        {
          id: "tank-performances",
          label: t("links.tank-performances.label"),
          href: tankTabHref(tanks, TankTab.Performances),
          description: t("links.tank-performances.description"),
        },
        {
          id: "tank-specs",
          label: t("links.tank-specs.label"),
          href: tankTabHref(tanks, TankTab.Specifications),
          description: t("links.tank-specs.description"),
        },
        {
          id: "tank-economics",
          label: t("links.tank-economics.label"),
          href: tankTabHref(tanks, TankTab.Economics),
          description: t("links.tank-economics.description"),
        },
        {
          id: "tank-moe",
          label: tGame("features.marks-of-excellence"),
          href: tankTabHref(tanks, TankTab.MarksOfExcellence),
          description: t("links.tank-moe.description"),
        },
        {
          id: "tank-mom",
          label: tGame("features.marks-of-mastery"),
          href: tankTabHref(tanks, TankTab.MarksOfMastery),
          description: t("links.tank-mom.description"),
        },
        {
          id: "tank-changes",
          label: t("links.tank-changes.label"),
          href: ROUTES.TANKS_CHANGES(region),
          description: t("links.tank-changes.description"),
        },
        {
          id: "tank-community",
          label: t("links.tank-community.label"),
          href: ROUTES.TANKS_COMMUNITY(region),
          description: t("links.tank-community.description"),
        },
        {
          id: "tank-videos",
          label: t("links.tank-videos.label"),
          href: tankTabHref(tanks, TankTab.Videos),
          description: t("links.tank-videos.description"),
        },
      ],
    },
    {
      id: "tournaments",
      label: t("sections.tournaments"),
      links: [
        {
          id: "all-tournaments",
          // Just "Tournaments": the section holds one page, so it is folded
          // into another column in the footer and "All" qualifies nothing.
          label: t("links.all-tournaments.label"),
          href: ROUTES.TOURNAMENTS(region),
          description: t("links.all-tournaments.description"),
        },
      ],
    },
    {
      id: "maps",
      label: t("sections.maps"),
      links: [
        {
          id: "all-maps",
          label: t("links.all-maps.label"),
          href: maps,
          description: t("links.all-maps.description"),
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
          label: battleTypeName(type, tGame),
          href: mapsTabHref(maps, type),
          description: t("links.battle-type.description", {
            type: battleTypeName(type, tGame),
          }),
        })),
        {
          id: "map-changes",
          label: t("links.map-changes.label"),
          href: ROUTES.MAPS_CHANGES(region),
          description: t("links.map-changes.description"),
        },
      ],
    },
    {
      // One page for now. It is its own section rather than a link tucked under
      // Players because it is about the servers, not about who is on them, and
      // because the per-server pages it will grow have nowhere else to hang.
      id: "servers",
      label: t("sections.servers"),
      links: [
        {
          id: "servers-population",
          // Read on its own in the footer's list, away from the "Servers"
          // heading that used to carry the context, so it names the subject.
          label: t("links.servers-population.label"),
          href: ROUTES.SERVERS(region),
          description: t("links.servers-population.description"),
        },
      ],
    },
  ];
}
