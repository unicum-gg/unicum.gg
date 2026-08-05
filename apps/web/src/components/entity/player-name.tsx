import type { ReactNode } from "react";
import type { Region } from "@unicum.gg/wargaming";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * A player's nickname wherever it appears (leaderboards, clan members, tank top
 * players, compare, search). Renders the name, an optional trailing clan tag,
 * and links to the player page (`ROUTES.PLAYER`) unless `link` is false (the
 * player's own header, non-navigational table headers).
 *
 * The `badges` slot is the whole point of centralising this: badges (the live
 * Twitch pill, the supporter badge, and future unicum achievements) render
 * after the name, outside the link, in one consistent place. The link wraps
 * only the name + clan tag so a click on either navigates to the profile while
 * a badge keeps its own target.
 */
export function PlayerName({
  region,
  nickname,
  link = true,
  clan,
  badges,
  className,
  linkClassName,
  nicknameClassName,
}: {
  region: Region;
  nickname: string;
  /** Wrap the name (+ clan tag) in a link to the player page. */
  link?: boolean;
  /** Optional clan tag shown right after the nickname. */
  clan?: { tag: string; color: string | null } | null;
  /** Trailing badges, rendered after the name and outside the link. */
  badges?: ReactNode;
  className?: string;
  /** Applied to the name/link wrapper (e.g. truncation, extra flex sizing). */
  linkClassName?: string;
  nicknameClassName?: string;
}) {
  const body = (
    <>
      <span className={cn("font-medium", nicknameClassName)}>{nickname}</span>
      {clan ? (
        <>
          {" "}
          <ClanTag
            tag={clan.tag}
            color={clan.color}
            className="font-mono text-xs"
          />
        </>
      ) : null}
    </>
  );
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {link ? (
        <Link
          href={ROUTES.PLAYER(region, nickname)}
          className={cn("min-w-0 truncate hover:underline", linkClassName)}
        >
          {body}
        </Link>
      ) : (
        <span className={cn("min-w-0 truncate", linkClassName)}>{body}</span>
      )}
      {badges}
    </span>
  );
}
