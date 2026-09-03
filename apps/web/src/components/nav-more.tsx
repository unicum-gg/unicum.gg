"use client";

import {
  BookOpenIcon,
  FileCodeIcon,
  HeartIcon,
  PlugsConnectedIcon,
  PulseIcon,
  RankingIcon,
  RobotIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { NavMoreMenu } from "@/components/nav-more-menu";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";

/**
 * The navbar's "More" dropdown: everything that is not one of the four
 * catalogue sections.
 *
 * A Client Component because one of its destinations is regional. The list used
 * to be built inline in `layout.shared.tsx`, which is fine while every URL is
 * region-less (the integrations, the glossary, the support page) and wrong the
 * moment one is not: a reader on NA would have been sent to the EU servers page
 * by a menu that had no way of knowing which region they were browsing.
 * `useRegion` reads it from the path, the same way the section menus do.
 */
export function NavMore() {
  const { region } = useRegion();

  return (
    <NavMoreMenu
      text="More"
      items={[
        {
          // First, with Servers: these two are the pages about the GAME, the
          // rest being integrations and pages about the project. Regional, like
          // Servers, which is the reason this menu became a Client Component.
          text: "Tournaments",
          description: "Brackets, rosters and results, region by region",
          url: ROUTES.TOURNAMENTS(region),
          icon: <RankingIcon />,
        },
        {
          text: "Servers",
          description: "Players online, now and over time",
          url: ROUTES.SERVERS(region),
          icon: <PulseIcon />,
        },
        {
          text: "Discord bot",
          description: "Player, clan and tank stats as slash commands",
          url: ROUTES.BOT,
          icon: <RobotIcon />,
        },
        {
          text: "MCP server",
          description: "Connect Claude, ChatGPT or any MCP client",
          url: ROUTES.MCP,
          icon: <PlugsConnectedIcon />,
        },
        {
          text: "API",
          description: "Free public REST API, no key required",
          url: ROUTES.DOCS,
          icon: <FileCodeIcon />,
        },
        {
          text: "Badges",
          description: "Every crest a player or clan can earn, and how",
          url: ROUTES.BADGES,
          icon: <SealCheckIcon />,
        },
        {
          text: "Glossary",
          description: "Every World of Tanks term, explained",
          url: ROUTES.GLOSSARY,
          icon: <BookOpenIcon />,
        },
        {
          text: "Support us",
          description: `Keep ${APP.NAME} free, open and ad-free`,
          url: ROUTES.SUPPORT,
          icon: <HeartIcon />,
        },
      ]}
    />
  );
}
