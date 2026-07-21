"use client";

import {
  ArrowSquareOutIcon,
  BookOpenIcon,
  DotsThreeVerticalIcon,
  RankingIcon,
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
import { SETUP_PARAM } from "@/components/tanks/detail/specifications/config-url";
import {
  type SearchHistoryItem,
  useSearchHistory,
} from "@/hooks/use-search-history";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { REGION_WOT_HOST, type Region } from "@unicum.gg/wargaming";

/**
 * Overflow menu for the tank header, folding the per-tank actions (favorite,
 * share, WoT tankopedia/ratings, and open-in-AI) behind a single "⋯" button.
 * Mirrors the player/clan header menus.
 */
export function TankActionsMenu({
  region,
  tankId,
  tag,
  name,
  slug,
  favoriteItem,
}: {
  region: Region;
  tankId: number;
  tag: string;
  name: string;
  slug: string;
  favoriteItem: SearchHistoryItem;
}) {
  const { isFavorite, toggleFavorite } = useSearchHistory();
  const [shareOpen, setShareOpen] = useState(false);
  // The configurator setup lives in the current URL's query string; capture it
  // when Share opens so the modal can offer "Share with setup" (empty when the
  // tank is at its stock config).
  const [setupParams, setSetupParams] = useState("");
  const fav = isFavorite(favoriteItem);
  const url = `${APP.URL}${ROUTES.TANK(region, slug)}`;

  function openShare() {
    const token = new URLSearchParams(window.location.search).get(SETUP_PARAM);
    setSetupParams(token ? `${SETUP_PARAM}=${token}` : "");
    setShareOpen(true);
  }

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
          <DropdownMenuItem onSelect={() => openShare()}>
            <ShareNetworkIcon weight="bold" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://${REGION_WOT_HOST[region]}/en/tankopedia/${tankId}-${tag}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpenIcon weight="bold" />
              Open in Tankopedia
              <ArrowSquareOutIcon className="ml-auto size-3 text-fd-muted-foreground" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://${REGION_WOT_HOST[region]}/en/ratings/vehicles/${tag}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RankingIcon weight="bold" />
              Open in vehicle ratings
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
        title={`Share ${name}`}
        url={url}
        shareText={`Check ${name}'s WoT stats on ${APP.NAME}`}
        ogImage={`${APP.URL}/${region}/tanks/${slug}/opengraph-image`}
        setupParams={setupParams}
      />
    </>
  );
}
