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
import { useTranslation } from "@/hooks/use-translation";

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
  const { t } = useTranslation("components/nav-more");

  return (
    <NavMoreMenu
      text={t("label")}
      items={[
        {
          // First, with Servers: these two are the pages about the GAME, the
          // rest being integrations and pages about the project. Regional, like
          // Servers, which is the reason this menu became a Client Component.
          text: t("items.tournaments.label"),
          description: t("items.tournaments.description"),
          url: ROUTES.TOURNAMENTS(region),
          icon: <RankingIcon />,
        },
        {
          text: t("items.servers.label"),
          description: t("items.servers.description"),
          url: ROUTES.SERVERS(region),
          icon: <PulseIcon />,
        },
        {
          text: t("items.bot.label"),
          description: t("items.bot.description"),
          url: ROUTES.BOT,
          icon: <RobotIcon />,
        },
        {
          text: t("items.mcp.label"),
          description: t("items.mcp.description"),
          url: ROUTES.MCP,
          icon: <PlugsConnectedIcon />,
        },
        {
          text: t("items.api.label"),
          description: t("items.api.description"),
          url: ROUTES.DOCS,
          icon: <FileCodeIcon />,
        },
        {
          text: t("items.badges.label"),
          description: t("items.badges.description"),
          url: ROUTES.BADGES,
          icon: <SealCheckIcon />,
        },
        {
          text: t("items.glossary.label"),
          description: t("items.glossary.description"),
          url: ROUTES.GLOSSARY,
          icon: <BookOpenIcon />,
        },
        {
          text: t("items.support.label"),
          description: t("items.support.description", { name: APP.NAME }),
          url: ROUTES.SUPPORT,
          icon: <HeartIcon />,
        },
      ]}
    />
  );
}
