import {
  DiscordLogoIcon,
  FileCodeIcon,
  GithubLogoIcon,
  HeartIcon,
  PlugsConnectedIcon,
  RobotIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { NavLogo } from "@/components/nav-logo";
import { NavMoreMenu } from "@/components/nav-more-menu";
import { NavSectionMenu } from "@/components/nav-section-menu";
import { RatingSelector } from "@/components/rating-selector";
import { RegionSelector } from "@/components/region-selector";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";

// `sections` toggles the Players/Clans/Tanks + "More" site-navigation links, and
// `selectors` the rating-metric + region pickers. The main site nav shows both,
// but a standalone section like `/docs` (its own nav + a tag-grouped sidebar
// that would otherwise duplicate the section links) passes both `false`.
export async function baseOptions({
  selectors = true,
  sections = true,
}: { selectors?: boolean; sections?: boolean } = {}): Promise<BaseLayoutProps> {
  return {
    nav: {
      // NavLogo is a Client Component that picks its href from usePathname,
      // so the navbar logo stays aligned with the current region even after
      // soft client-side navigations (the root layout doesn't re-execute).
      title: NavLogo,
    },
    links: [
      ...(sections
        ? ([
            {
              type: "custom",
              children: <NavSectionMenu section="players" />,
            },
            {
              type: "custom",
              children: <NavSectionMenu section="clans" />,
            },
            {
              type: "custom",
              children: <NavSectionMenu section="tanks" />,
            },
            {
              type: "custom",
              children: <NavSectionMenu section="maps" />,
            },
            // The region-less surfaces (integrations + API), grouped under one
            // dropdown so the main nav stays three sections. `custom` rather
            // than fumadocs' `menu`, so the panel can be force-mounted and its
            // links stay in the server HTML (see `NavMoreMenu`).
            {
              type: "custom",
              children: (
                <NavMoreMenu
                  text="More"
                  items={[
                    {
                      text: "Discord bot",
                      description:
                        "Player, clan and tank stats as slash commands",
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
                      text: "Support us",
                      description: `Keep ${APP.NAME} free, open and ad-free`,
                      url: ROUTES.SUPPORT,
                      icon: <HeartIcon />,
                    },
                  ]}
                />
              ),
            },
          ] satisfies BaseLayoutProps["links"])
        : []),
      ...(selectors
        ? ([
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
          ] satisfies BaseLayoutProps["links"])
        : []),
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
