"use client";

import {
  ArrowSquareOutIcon,
  DotsThreeVerticalIcon,
  GlobeIcon,
  ShareNetworkIcon,
  StarIcon,
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
import { useSearchHistory } from "@/hooks/use-search-history";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { REGION_PORTAL_HOST, type Region } from "@unicum.gg/wargaming";

/**
 * Overflow menu for the clan header, folding the per-clan actions (favorite,
 * share, WoT portal, and open-in-AI) behind a single "⋯" button. Mirrors the
 * player header menu; compare keeps its own button since its search popover
 * doesn't nest inside a menu.
 */
export function ClanActionsMenu({
  region,
  clan,
}: {
  region: Region;
  clan: {
    id: number;
    tag: string;
    name: string;
    color: string;
    membersCount: number;
    emblem: string | null;
  };
}) {
  const { isFavorite, toggleFavorite } = useSearchHistory();
  const [shareOpen, setShareOpen] = useState(false);

  const favoriteItem = {
    kind: "clan" as const,
    region,
    clan: {
      clan_id: clan.id,
      tag: clan.tag,
      name: clan.name,
      color: clan.color,
      members_count: clan.membersCount,
      emblem: clan.emblem,
    },
  };
  const fav = isFavorite(favoriteItem);
  const url = `${APP.URL}${ROUTES.CLAN(region, clan.tag)}`;

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
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              toggleFavorite(favoriteItem);
            }}
          >
            <StarIcon weight={fav ? "fill" : "bold"} />
            {fav ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <ShareNetworkIcon weight="bold" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://${REGION_PORTAL_HOST[region]}/clans/wot/${clan.id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GlobeIcon weight="bold" />
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
        title={`Share [${clan.tag}]`}
        url={url}
        shareText={`Check [${clan.tag}] ${clan.name} on ${APP.NAME}`}
        ogImage={`${url}/opengraph-image`}
      />
    </>
  );
}
