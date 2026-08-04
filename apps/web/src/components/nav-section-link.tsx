"use client";

import { usePathname } from "next/navigation";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { Region, regionFromPathname } from "@unicum.gg/wargaming";

type Section = "players" | "clans" | "tanks" | "maps";

const ROUTE_FOR: Record<Section, (region: Region) => string> = {
  players: ROUTES.PLAYERS,
  clans: ROUTES.CLANS,
  tanks: ROUTES.TANKS,
  maps: ROUTES.MAPS,
};

/**
 * Region-aware navbar item. Styling matches fumadocs' built-in `main` link
 * type, sourced from
 * `node_modules/fumadocs-ui/dist/layouts/home/slots/header.js`.
 */
export function NavSectionLink({
  text,
  section,
}: {
  text: string;
  section: Section;
}) {
  const { region } = useRegion();
  const pathname = usePathname();
  // Active when the section segment of the current path matches, regardless
  // of region prefix: `/players/...`, `/eu/players/...`, `/asia/players/...`
  // all light up the Players item.
  const segments = pathname.split("/").filter(Boolean);
  const segIdx = regionFromPathname(pathname) === null ? 0 : 1;
  const active = segments[segIdx] === section;
  // Hover-prefetch: fumadocs renders this item twice (desktop bar + hidden
  // mobile menu), so eager viewport prefetch double-fetches every section on
  // load. Warming on intent keeps the desktop nav instant without the mobile
  // copy ever prefetching. See HoverPrefetchLink.
  return (
    <HoverPrefetchLink
      href={ROUTE_FOR[section](region)}
      data-active={active}
      className="inline-flex items-center gap-1 p-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary [&_svg]:size-4"
    >
      {text}
    </HoverPrefetchLink>
  );
}
