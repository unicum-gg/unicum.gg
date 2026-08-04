"use client";

import {
  DotsThreeVerticalIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { PageAiActions } from "@/components/page-ai-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareModal } from "@/components/share-modal";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { unicumPublic } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Overflow menu for the map header: share the map + open-in-AI, behind a single
 * "⋯" button. Mirrors the player/tank/clan header menus (maps have no favorite
 * or WoT-portal counterpart, so it is share + AI only).
 */
export function MapActionsMenu({
  region,
  slug,
  name,
}: {
  region: Region;
  slug: string;
  name: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const url = `${APP.URL}${ROUTES.MAP(region, slug)}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none aria-expanded:bg-fd-secondary aria-expanded:text-fd-foreground"
        >
          <DotsThreeVerticalIcon className="size-3.5" weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <ShareNetworkIcon weight="bold" />
            Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <PageAiActions />
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={`Share ${name}`}
        url={url}
        shareText={`Check the ${name} map on ${APP.NAME}`}
        ogImage={unicumPublic.og.region(region).maps(slug).url()}
      />
    </>
  );
}
