"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";
import { ClanSearchPopover } from "@/components/clans/compare/clan-search-popover";

export function CompareWithButton({
  region,
  current,
}: {
  region: Region;
  current: string;
}) {
  const router = useRouter();
  const excludeKeys = new Set([current.toLowerCase()]);

  return (
    <ClanSearchPopover
      region={region}
      excludeKeys={excludeKeys}
      onPick={(tag) => {
        router.push(ROUTES.COMPARE_CLANS(region, [current, tag]));
      }}
      triggerAriaLabel="Compare with another clan"
      tooltip="Compare with..."
      triggerClassName="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
      triggerContent={<ArrowsLeftRightIcon className="size-3.5" weight="bold" />}
    />
  );
}
