"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { formatTankRef, TankClient } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  encodeSetups,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";
import ROUTES from "@/constants/routes";

/**
 * Put the vehicle up against its own Common Test version.
 *
 * The switch above shows one client at a time, which answers "what does the test
 * change" only by remembering the previous screen. This lands both on the same
 * board, side by side, which is the reading a test build is actually for.
 *
 * The build on screen rides along on both columns, so a comparison starts from
 * the same equipment and crew rather than from two pristine vehicles: the whole
 * point is the difference between the clients, not between two setups. Like
 * `CompareWithTank` it takes the portable token, the one that spells its modules
 * out, since a comparison column opens on top modules where a tank page opens on
 * stock.
 *
 * Renders nothing when no test touches this vehicle, which is most of them.
 */
export function CompareClients({
  region,
  slug,
  testVersion,
  setupToken,
}: {
  region: Region;
  slug: string;
  /** The test build available for this vehicle, null when there is none. */
  testVersion: string | null;
  /** The build's portable setup token, or null when it is pristine. */
  setupToken: string | null;
}) {
  if (!testVersion) return null;
  const href = ROUTES.COMPARE_TANKS(region, [
    slug,
    formatTankRef({ slug, client: TankClient.CommonTest }),
  ]);
  const setups = encodeSetups([setupToken, setupToken]);
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={setups ? `${href}?${SETUP_PARAM}=${setups}` : href}
            aria-label="Compare the live and Common Test versions"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
          >
            <ArrowsLeftRightIcon className="size-3.5" weight="bold" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          Compare live against Common Test {testVersion}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
