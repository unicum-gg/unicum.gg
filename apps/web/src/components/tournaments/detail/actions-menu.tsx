"use client";

import {
  ArrowSquareOutIcon,
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
import { REGION_WOT_HOST, type Region } from "@unicum.gg/wargaming";

/**
 * Overflow menu for a tournament or team header: share, open on the WoT portal,
 * and hand the page to an LLM, behind one "⋯" button. Mirrors the
 * player/clan/tank/map header menus.
 *
 * The portal path is Wargaming's own and matches ours segment for segment
 * (`/tournaments/{id}` and `/tournaments/{id}/team/{teamId}`), which is worth
 * saying because it is the reason this link is a template rather than something
 * mirrored: their tournament pages render client-side, so the deep link is the
 * only way back to the source.
 */
export function TournamentActionsMenu({
  region,
  tournamentId,
  teamId,
  title,
  path,
  ogImage,
}: {
  region: Region;
  tournamentId: number;
  /** Set on a team page, so the portal link opens that team rather than the
   * tournament. */
  teamId?: number;
  title: string;
  /** This page's path on our own site, for the share URL. */
  path: string;
  ogImage?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const url = `${APP.URL}${path}`;
  const portal = `https://${REGION_WOT_HOST[region]}/en/tournaments/${tournamentId}/${
    teamId === undefined ? "" : `team/${teamId}/`
  }`;

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
          <DropdownMenuItem asChild>
            <a href={portal} target="_blank" rel="nofollow noopener noreferrer">
              <ArrowSquareOutIcon weight="bold" />
              Open on WoT portal
              <ArrowSquareOutIcon className="ml-auto size-3 text-fd-muted-foreground" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <PageAiActions />
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={`Share ${title}`}
        url={url}
        shareText={`Check ${title} on ${APP.NAME}`}
        ogImage={ogImage}
      />
    </>
  );
}
