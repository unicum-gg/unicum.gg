"use client";

import { ListMagnifyingGlassIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { Region } from "@unicum.gg/wargaming";

import { TankSearchPopover } from "@/components/tanks/tank-search-popover";
import ROUTES from "@/constants/routes";

/** The chrome the hero's corner controls share. */
const MARK =
  "inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none aria-expanded:bg-fd-secondary aria-expanded:text-fd-foreground";

/**
 * Go straight to another vehicle, without leaving the picture to do it.
 *
 * **The same search as the site's, asked from where a reader already is.** The
 * bar at the top finds anything: a player, a clan, a map. Someone looking at a
 * tank and wanting the next one has to pass through all of that to say what
 * they already knew, so this asks the narrower question in the corner of the
 * vehicle they are asking it about.
 *
 * The build is deliberately left behind. Carrying it would be
 * `CopyToTank`, which is a different thing to want and lives with the
 * characteristics it copies: this is "show me that tank", not "show me that
 * tank set up like this one".
 */
export function HeroOpenTank({
  region,
  slug,
}: {
  region: Region;
  slug: string;
}) {
  const router = useRouter();
  return (
    <TankSearchPopover
      region={region}
      excludeSlugs={new Set([slug])}
      onPick={(tank) => router.push(ROUTES.TANK(region, tank.slug))}
      triggerAriaLabel="Open another tank"
      tooltip="Open another tank"
      placeholder="Open tank..."
      triggerClassName={MARK}
      triggerContent={
        <ListMagnifyingGlassIcon className="size-3.5" weight="bold" />
      }
    />
  );
}
