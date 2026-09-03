import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ClanBoard } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { ClanBadges } from "@/components/entity/badges/clan-rank-badge";
import { ClanTag } from "@/components/entity/clan-tag";
import type { ClanIdentity } from "@/components/entity/clan-identity";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * A clan wherever it appears: its emblem, the coloured tag, its name, then its
 * crests. The clan-side twin of `PlayerName`, and the only thing that renders
 * that order.
 *
 * The crests are not a slot. Fourteen places linked a clan and three showed its
 * badges, which is the same drift the player side had: a clan ranked second on
 * a board wore the mark on the leaderboard and nothing anywhere else.
 *
 * The link wraps the emblem, tag and name ONLY. That is a hard requirement, not
 * a layout preference: every rank crest is itself a link to its board, and an
 * anchor inside an anchor is invalid and unclickable.
 */
export function ClanName({
  region,
  clan,
  link = true,
  href,
  showName = false,
  showEmblem = false,
  omitBoard,
  size = 16,
  trailing,
  className,
  linkClassName,
  tagClassName,
  nameClassName,
}: {
  region: Region;
  clan: ClanIdentity;
  link?: boolean;
  /** Where the tag points, when it is not the clan's overview: the stronghold
   * board sends a row to that clan's own stronghold page. */
  href?: string;
  /** Render the full clan name after the tag. Off in dense rows. */
  showName?: boolean;
  showEmblem?: boolean;
  /** Drop one board's placing, for a table that already IS that board: the
   * stronghold leaderboard need not repeat "2nd in stronghold" on every row. */
  omitBoard?: ClanBoard;
  size?: number;
  trailing?: ReactNode;
  className?: string;
  linkClassName?: string;
  tagClassName?: string;
  nameClassName?: string;
}) {
  const body = (
    <>
      {showEmblem &&
        (clan.emblem ? (
          <Image
            src={clan.emblem}
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded"
          />
        ) : (
          <span className="size-6 shrink-0 rounded bg-muted" />
        ))}
      <span className="min-w-0 truncate">
        <ClanTag
          tag={clan.tag}
          color={clan.color ?? null}
          className={cn("font-mono font-semibold", tagClassName)}
        />
        {showName && clan.name ? (
          <>
            {" "}
            <span className={cn("text-muted-foreground", nameClassName)}>
              {clan.name}
            </span>
          </>
        ) : null}
      </span>
    </>
  );
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {link ? (
        <Link
          href={href ?? ROUTES.CLAN(region, clan.tag)}
          className={cn(
            "flex min-w-0 items-center gap-2 hover:underline",
            linkClassName,
          )}
        >
          {body}
        </Link>
      ) : (
        <span className={cn("flex min-w-0 items-center gap-2", linkClassName)}>
          {body}
        </span>
      )}
      <ClanBadges
        badges={
          omitBoard ? clan.badges?.filter((b) => b.board !== omitBoard) : clan.badges
        }
        region={region}
        tag={clan.tag}
        tournamentWins={clan.tournamentWins ?? 0}
        tournamentFeaturedWins={clan.tournamentFeaturedWins ?? 0}
        tournamentBestTitle={clan.tournamentBestTitle ?? null}
        size={size}
      />
      {trailing}
    </span>
  );
}
