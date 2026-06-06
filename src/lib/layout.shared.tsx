import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { cookies } from "next/headers";
import { NavLogo } from "@/components/nav-logo";
import { RatingSelector } from "@/components/rating-selector";
import { RegionSelector } from "@/components/region-selector";
import APP from "@/constants/app";

export async function baseOptions(): Promise<BaseLayoutProps> {
  // Touch `cookies()` so every page rendered through this layout opts out
  // of static generation. Pages like `/coverage` hit the DB at render time
  // and would otherwise be prerendered at build, where the postgres host
  // isn't resolvable in the build container. We don't actually use the
  // returned value here; reading cookies is the canonical Next signal.
  await cookies();
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
