"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { regionFromPathname } from "@unicum.gg/wargaming";
import {
  ChartLineUpIcon,
  ChatsCircleIcon,
  CoinsIcon,
  CrosshairIcon,
  FlagIcon,
  FlagBannerIcon,
  GaugeIcon,
  LightningIcon,
  MapTrifoldIcon,
  MedalIcon,
  MoonStarsIcon,
  PencilRulerIcon,
  RankingIcon,
  ScalesIcon,
  ShieldIcon,
  ShuffleIcon,
  StarIcon,
  SwordIcon,
  TrophyIcon,
  UsersThreeIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react/dist/ssr";
import { NavMoreMenu } from "@/components/nav-more-menu";
import { navSections, type NavSectionId } from "@/components/nav-sections";
import { useRegion } from "@/hooks/use-region";

/** An icon per sub-link, keyed by its stable `navSections` id. Kept here rather
 * than in `navSections` so that file stays a plain, footer-safe data module. */
const LINK_ICON: Record<string, ReactNode> = {
  "top-players": <TrophyIcon />,
  "players-onslaught": <SwordIcon />,
  "players-steel-hunter": <CrosshairIcon />,
  "top-clans": <UsersThreeIcon />,
  stronghold: <ShieldIcon />,
  advances: <FlagBannerIcon />,
  "tank-performances": <ChartLineUpIcon />,
  "tank-specs": <GaugeIcon />,
  "tank-economics": <CoinsIcon />,
  "tank-moe": <MedalIcon />,
  "tank-mom": <StarIcon />,
  "tank-changes": <ScalesIcon />,
  "tank-community": <ChatsCircleIcon />,
  "tank-videos": <VideoCameraIcon />,
  "all-maps": <MapTrifoldIcon />,
  "maps-random": <ShuffleIcon />,
  "maps-frontline": <FlagIcon />,
  "maps-onslaught": <SwordIcon />,
  "maps-onslaught-night": <MoonStarsIcon />,
  "maps-grand-battle": <LightningIcon />,
  "maps-clan-wars": <ShieldIcon />,
  "map-changes": <PencilRulerIcon />,
  "all-tournaments": <RankingIcon />,
};

/**
 * A navbar section as a dropdown, rendered through the exact same `NavMoreMenu`
 * as the "More" menu (icon + title + description cards, force-mounted for
 * crawlability). The only difference is the data: region-aware sub-pages from
 * `navSections`, the one source the footer reads too.
 */
export function NavSectionMenu({ section }: { section: NavSectionId }) {
  const { region } = useRegion();
  const pathname = usePathname();
  const data = navSections(region).find((s) => s.id === section);
  if (!data) return null;

  // Active when the section segment matches, region prefix aside, like the
  // plain section link did: `/players`, `/eu/players`, `/asia/players` all
  // light up Players.
  const segments = pathname.split("/").filter(Boolean);
  const segIdx = regionFromPathname(pathname) === null ? 0 : 1;
  const active = segments[segIdx] === section;

  return (
    <NavMoreMenu
      text={data.label}
      active={active}
      items={data.links.map((link) => ({
        text: link.label,
        description: link.description,
        url: link.href,
        icon: LINK_ICON[link.id] ?? null,
      }))}
    />
  );
}
