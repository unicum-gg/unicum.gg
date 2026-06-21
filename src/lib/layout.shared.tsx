import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { NavLogo } from "@/components/nav-logo";
import { NavSectionLink } from "@/components/nav-section-link";
import { RatingSelector } from "@/components/rating-selector";
import { RegionSelector } from "@/components/region-selector";
import APP from "@/constants/app";

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
    ],
    githubUrl: APP.EXTERNAL.GITHUB,
  };
}
