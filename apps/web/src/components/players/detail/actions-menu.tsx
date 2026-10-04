"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  ArrowSquareOutIcon,
  DotsThreeVerticalIcon,
  GlobeIcon,
  ShareNetworkIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageAiActions } from "@/components/page-ai-actions";
import { ShareModal } from "@/components/share-modal";
import { useSearchHistory } from "@/hooks/use-search-history";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { REGION_WOT_HOST, type Region } from "@unicum.gg/wargaming";
import { unicumPublic } from "@/services/sdk";

/**
 * Overflow menu for the player header, folding the per-player actions
 * (favorite, share, WoT portal) behind a single "⋯" button so the header stays
 * uncluttered. Compare keeps its own button since its search popover doesn't
 * nest inside a menu, and so does the connections button, for a different
 * reason: a reader hunting for where to disconnect an account will not think to
 * open a "⋯".
 *
 * Connecting Twitch and its orange-dot nudge used to live here and moved there
 * with it, which also took this component's session read and its
 * `listAccounts` call off every own-profile view.
 */
export function PlayerActionsMenu({
  region,
  accountId,
  nickname,
}: {
  region: Region;
  accountId: number;
  nickname: string;
}) {
  const { t } = useTranslation("components/players/detail/actions-menu");
  const { t: tMenu } = useTranslation("components/actions-menu");
  const { isFavorite, toggleFavorite } = useSearchHistory();
  const [shareOpen, setShareOpen] = useState(false);

  const favoriteItem = {
    kind: "player" as const,
    region,
    player: { account_id: accountId, nickname, clan: null },
  };
  const fav = isFavorite(favoriteItem);
  const url = `${APP.URL}${ROUTES.PLAYER(region, nickname)}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("more-actions")}
          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none aria-expanded:bg-fd-secondary aria-expanded:text-fd-foreground"
        >
          <DotsThreeVerticalIcon className="size-3.5" weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              // Keep the menu open so the label flips to "Remove from
              // favorites" in place instead of closing on the first click.
              e.preventDefault();
              toggleFavorite(favoriteItem);
            }}
          >
            <StarIcon weight={fav ? "fill" : "bold"} />
            {fav ? t("remove-from-favorites") : t("add-to-favorites")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <ShareNetworkIcon weight="bold" />
            {tMenu("share")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://${REGION_WOT_HOST[region]}/en/community/accounts/${accountId}-${nickname}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GlobeIcon weight="bold" />
              {tMenu("open-in", { target: "WoT portal" })}
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
        title={tMenu("share-title", { name: nickname })}
        url={url}
        shareText={tMenu("share-text-player", { name: nickname, app: APP.NAME })}
        ogImage={unicumPublic.og.region(region).players(nickname).url()}
      />
    </>
  );
}
