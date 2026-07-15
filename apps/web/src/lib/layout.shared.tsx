import {
  DiscordLogoIcon,
  FileCodeIcon,
  GithubLogoIcon,
  PlugsConnectedIcon,
  RobotIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { NavLogo } from "@/components/nav-logo";
import { NavSectionLink } from "@/components/nav-section-link";
import { RatingSelector } from "@/components/rating-selector";
import { RegionSelector } from "@/components/region-selector";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";

export async function baseOptions(): Promise<BaseLayoutProps> {
  return {
    nav: {
      // NavLogo is a Client Component that picks its href from usePathname,
      // so the navbar logo stays aligned with the current region even after
      // soft client-side navigations (the root layout doesn't re-execute).
      title: NavLogo,
    },
    links: [
      {
        type: "custom",
        children: <NavSectionLink text="Players" section="players" />,
      },
      {
        type: "custom",
        children: <NavSectionLink text="Clans" section="clans" />,
      },
      {
        type: "custom",
        children: <NavSectionLink text="Tanks" section="tanks" />,
      },
      // The region-less surfaces (integrations + API), grouped under one
      // dropdown so the main nav stays three sections.
      {
        type: "menu",
        text: "More",
        items: [
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
        ],
      },
      {
        type: "custom",
        secondary: true,
        children: <RatingSelector />,
      },
      {
        type: "custom",
        secondary: true,
        children: <RegionSelector />,
      },
      // Discord + GitHub as Phosphor icons in the nav's secondary slot, in place
      // of fumadocs' built-in `githubUrl` icon, so both share the same style.
      {
        type: "icon",
        url: APP.EXTERNAL.DISCORD,
        text: "Discord",
        label: "Discord",
        icon: <DiscordLogoIcon weight="fill" />,
        external: true,
      },
      {
        type: "icon",
        url: APP.EXTERNAL.GITHUB,
        text: "GitHub",
        label: "GitHub",
        icon: <GithubLogoIcon weight="fill" />,
        external: true,
      },
    ],
  };
}
