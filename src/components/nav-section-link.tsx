"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ROUTES from "@/constants/routes";
import { Region, regionFromPathname } from "@/services/wargaming/wot";

type Section = "players" | "clans";

const ROUTE_FOR: Record<Section, (region: Region) => string> = {
  players: ROUTES.PLAYERS,
  clans: ROUTES.CLANS,
};

/**
 * Region-aware navbar item. Mirrors `NavLogo` so soft-navs across regions
 * keep the link in sync with the URL (the root layout doesn't re-execute).
 * Styling matches fumadocs' built-in `main` link type, sourced from
 * `node_modules/fumadocs-ui/dist/layouts/home/slots/header.js`.
 */
export function NavSectionLink({
  text,
  section,
}: {
  text: string;
  section: Section;
}) {
  const pathname = usePathname();
  const region = regionFromPathname(pathname) ?? Region.EU;
  const segments = pathname.split("/").filter(Boolean);
  const segIdx = region === Region.EU ? 0 : 1;
  const active = segments[segIdx] === section;
  return (
    <Link
      href={ROUTE_FOR[section](region)}
      data-active={active}
      className="inline-flex items-center gap-1 p-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:text-fd-primary [&_svg]:size-4"
    >
      {text}
    </Link>
  );
}
