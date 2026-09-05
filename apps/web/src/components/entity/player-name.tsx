import type { ReactNode } from "react";
import type { Region } from "@unicum.gg/wargaming";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { PlayerBadges } from "@/components/entity/badges/player-badges";
import type { PlayerIdentity } from "@/components/entity/player-identity";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * A player wherever they appear: the nickname, their clan tag, then their
 * crests. That order is the site's one format for naming a player, and this is
 * the only thing that renders it.
 *
 * The crests are NOT a slot the caller fills. They were, and the slot was
 * forgotten exactly as often as it was used: the clan members table passed no
 * tournament fields, so a winner wore the crest on the home leaderboard and
 * nothing in their own clan's list; the tank page's top players passed no
 * badges at all; and the leaderboards, the search rows and the tournament
 * rosters each rebuilt the name and tag by hand instead. Taking the whole
 * identity and rendering all of it is what makes the format the same
 * everywhere by construction rather than by discipline.
 *
 * The link wraps the name and tag only, so clicking either goes to the profile
 * while a crest keeps its own target.
 */
export function PlayerName({
  region,
  player,
  link = true,
  href,
  trailing,
  className,
  linkClassName,
  nicknameClassName,
}: {
  region: Region;
  player: PlayerIdentity;
  /** Wrap the name and tag in a link to the profile. Off for the player's own
   * header and for non-navigational rows. */
  link?: boolean;
  /** Where the name points, when it is not the profile: the Steel Hunter board
   * sends a row to that player's own Steel Hunter tab. The format stays the
   * same everywhere; only the destination varies. */
  href?: string;
  /** Anything that belongs after the crests, on the same line (the language
   * flags a leaderboard pushes to the right edge). */
  trailing?: ReactNode;
  className?: string;
  /** Applied to the name/link wrapper, for truncation or extra flex sizing. */
  linkClassName?: string;
  nicknameClassName?: string;
}) {
  const body = (
    <>
      <span className={cn("font-medium", nicknameClassName)}>
        {player.nickname}
      </span>
      {player.clanTag ? (
        <>
          {" "}
          <ClanTag
            tag={player.clanTag}
            color={player.clanColor ?? null}
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
          href={href ?? ROUTES.PLAYER(region, player.nickname)}
          className={cn("min-w-0 truncate hover:underline", linkClassName)}
        >
          {body}
        </Link>
      ) : (
        <span className={cn("min-w-0 truncate", linkClassName)}>{body}</span>
      )}
      <PlayerBadges region={region} player={player} />
      {trailing}
    </span>
  );
}
