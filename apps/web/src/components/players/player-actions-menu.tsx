"use client";

import {
  ArrowSquareOutIcon,
  DotsThreeVerticalIcon,
  GlobeIcon,
  ShareNetworkIcon,
  StarIcon,
  TwitchLogoIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
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
import { authClient, useSession } from "@/lib/auth-client";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { REGION_WOT_HOST, type Region } from "@unicum.gg/wargaming/region";

/**
 * Overflow menu for the player header, folding the per-player actions (favorite,
 * share, WoT portal, and — on your own profile — connect Twitch) behind a single
 * "⋯" button so the header stays uncluttered. Compare keeps its own button since
 * its search popover doesn't nest inside a menu.
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
  const { isFavorite, toggleFavorite } = useSearchHistory();
  const { data: session } = useSession();
  const [shareOpen, setShareOpen] = useState(false);

  const favoriteItem = {
    kind: "player" as const,
    region,
    player: { account_id: accountId, nickname, clan: null },
  };
  const fav = isFavorite(favoriteItem);
  const url = `${APP.URL}${ROUTES.PLAYER(region, nickname)}`;

  const wg = wgIdentityFromEmail(session?.user?.email);
  const isOwnProfile = wg?.region === region && wg?.accountId === accountId;

  // On your own profile, nudge you to link Twitch if you haven't yet (an orange
  // dot on the trigger + the menu item). Only fetched for the owner.
  const [twitchLinked, setTwitchLinked] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isOwnProfile) return;
    let cancelled = false;
    authClient
      .listAccounts()
      .then((res) => {
        if (!cancelled)
          setTwitchLinked(
            (res.data ?? []).some((a) => a.providerId === "twitch"),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile]);
  const needsTwitch = isOwnProfile && twitchLinked === false;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="relative inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none aria-expanded:bg-fd-secondary aria-expanded:text-fd-foreground"
        >
          <DotsThreeVerticalIcon className="size-3.5" weight="bold" />
          {needsTwitch ? (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#f25322] ring-2 ring-fd-background" />
          ) : null}
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
            {fav ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <ShareNetworkIcon weight="bold" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://${REGION_WOT_HOST[region]}/en/community/accounts/${accountId}-${nickname}/`}
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
          {needsTwitch ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  authClient.linkSocial({
                    provider: "twitch",
                    callbackURL: window.location.pathname,
                  })
                }
              >
                <TwitchLogoIcon weight="bold" />
                Connect Twitch
                <span className="ml-auto size-2 rounded-full bg-[#f25322]" />
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={`Share ${nickname}`}
        url={url}
        shareText={`Check ${nickname}'s WoT stats on ${APP.NAME}`}
        ogImage={`${url}/opengraph-image`}
      />
    </>
  );
}
