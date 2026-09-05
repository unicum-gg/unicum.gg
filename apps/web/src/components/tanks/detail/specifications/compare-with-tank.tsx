"use client";

import { ScalesIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { Region } from "@unicum.gg/wargaming";
import { TankSearchPopover } from "@/components/tanks/tank-search-popover";
import ROUTES from "@/constants/routes";
import {
  encodeSetups,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";

/**
 * Put this vehicle up against another: pick a second tank and land on the
 * comparison with both columns, this one carrying the build currently on screen
 * (the other opens on its top modules, like every unseeded column).
 *
 * It takes the build's *portable* token, the one that spells its modules out: a
 * comparison column opens on the top configuration where a tank page opens on
 * stock, so the short token would land this vehicle on modules the reader never
 * chose.
 *
 * The counterpart of `CopyToTank`, which moves a build sideways. This one keeps
 * the build where it is and adds something to read it against.
 */
export function CompareWithTank({
  region,
  slug,
  /** The build's portable setup token, or null when it is pristine. */
  setupToken,
  /** How the mark is drawn, since the two places that offer it are not alike. */
  triggerClassName = "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground",
}: {
  region: Region;
  slug: string;
  setupToken: string | null;
  triggerClassName?: string;
}) {
  const router = useRouter();

  return (
    <TankSearchPopover
      region={region}
      excludeSlugs={new Set([slug])}
      onPick={(tank) => {
        const href = ROUTES.COMPARE_TANKS(region, [slug, tank.slug]);
        const setups = encodeSetups([setupToken, null]);
        router.push(setups ? `${href}?${SETUP_PARAM}=${setups}` : href);
      }}
      triggerAriaLabel="Compare with another tank"
      tooltip="Compare with another tank"
      placeholder="Compare with..."
      triggerClassName={triggerClassName}
      triggerContent={<ScalesIcon className="size-3.5" weight="bold" />}
    />
  );
}
