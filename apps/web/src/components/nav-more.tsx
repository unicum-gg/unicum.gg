"use client";

import type { ReactNode } from "react";
import {
  BookOpenIcon,
  FileCodeIcon,
  PlugsConnectedIcon,
  PulseIcon,
  PuzzlePieceIcon,
  RankingIcon,
  RobotIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { NavMoreMenu } from "@/components/nav-more-menu";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The navbar's "More" dropdown: everything that is not one of the four
 * catalogue sections, as two families of four, a row each: the tools that take
 * unicum.gg out of the site, then the pages about the game. As one grid of nine
 * in three columns they fell on the rows in no order a reader could see.
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
  const { t } = useTranslation("components/nav-more");

  const item = (key: string, url: string, icon: ReactNode) => ({
    text: t(`items.${key}.label`),
    description: t(`items.${key}.description`),
    url,
    icon,
  });

  return (
    <NavMoreMenu
      text={t("label")}
      // Eight cards, so four across (see NavMoreMenu): each family is one
      // row, the same cards as every other menu, ordered rather than titled.
      items={[
        // What takes unicum.gg out of the site: into the game, Discord, an AI
        // assistant or someone's code. First, since the mod is here.
        item("mod", ROUTES.MOD, <PuzzlePieceIcon />),
        item("bot", ROUTES.BOT, <RobotIcon />),
        item("mcp", ROUTES.MCP, <PlugsConnectedIcon />),
        item("api", ROUTES.DOCS, <FileCodeIcon />),
        // Pages about the game itself. Two are regional, which is why this
        // menu is a Client Component.
        item("tournaments", ROUTES.TOURNAMENTS(region), <RankingIcon />),
        item("servers", ROUTES.SERVERS(region), <PulseIcon />),
        item("badges", ROUTES.BADGES, <SealCheckIcon />),
        item("glossary", ROUTES.GLOSSARY, <BookOpenIcon />),
        // Not "Support us": the top strip shows it on every page, in the brand
        // colour, and the footer links it too. A ninth card also left a row
        // with one card on it.
      ]}
    />
  );
}
