"use client";

import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { ClanTag } from "@/components/entity/clan-tag";
import { useEffect, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { useRegion } from "@/hooks/use-region";
import ROUTES from "@/constants/routes";
import { unicum } from "@/services/sdk";
import { wgIdentityFromEmail } from "@/lib/wg-session";

type UserClanTag = { tag: string; name: string; color: string };

/**
 * Top-bar Wargaming.net ID login, styled after WG's own discreet top-right
 * link. Logged out: a "Log in" link that kicks off the WG OpenID redirect for
 * the current region. Logged in: the nickname (linking to the player's own
 * profile, where account actions like connecting Twitch live), their current
 * clan tag, plus a log out.
 */
export function LoginWidget() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();
  // Keyed by user id so a stale tag from a previous session is never shown
  // (and so we never need a synchronous clear on logout).
  const [clan, setClan] = useState<{
    userId: string;
    tag: UserClanTag | null;
  } | null>(null);

  const userId = session?.user?.id;
  const email = session?.user?.email;
  const nickname = session?.user?.name;

  // The user's current clan, shown next to their name. Cheap DB-backed SDK call
  // (no live Wargaming), so it is fine to refresh on login change.
  useEffect(() => {
    const wg = wgIdentityFromEmail(email);
    if (!wg || !userId || !nickname) return;
    let alive = true;
    unicum
      .region(wg.region)
      .players(nickname)
      .clan()
      .then((res) => {
        if (alive) setClan({ userId, tag: res.clan });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, email, nickname]);

  if (isPending) {
    return <span className="shrink-0 text-fd-muted-foreground">—</span>;
  }

  if (session?.user) {
    const wg = wgIdentityFromEmail(session.user.email);
    const profileHref = wg
      ? ROUTES.PLAYER(wg.region, session.user.name)
      : null;
    const clanTag = clan?.userId === session.user.id ? clan.tag : null;
    const name = (
      <span className="flex items-baseline gap-1">
        {profileHref ? (
          <Link
            href={profileHref}
            className="font-medium tabular-nums text-fd-foreground hover:underline"
          >
            {session.user.name}
          </Link>
        ) : (
          <span className="font-medium tabular-nums text-fd-foreground">
            {session.user.name}
          </span>
        )}
        {clanTag &&
          (wg ? (
            <Link
              href={ROUTES.CLAN(wg.region, clanTag.tag)}
              className="tabular-nums text-fd-foreground hover:underline"
            >
              <ClanTag tag={clanTag.tag} color={clanTag.color} />
            </Link>
          ) : (
            <span className="tabular-nums text-fd-foreground">
              <ClanTag tag={clanTag.tag} color={clanTag.color} />
            </span>
          ))}
      </span>
    );
    return (
      <span className="flex shrink-0 items-center gap-2">
        {name}
        <button
          type="button"
          onClick={() =>
            signOut({
              fetchOptions: { onSuccess: () => window.location.reload() },
            })
          }
          className="cursor-pointer text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          Log out
        </button>
      </span>
    );
  }

  return (
    <a
      href={ROUTES.AUTH_SIGN_IN(region)}
      className="shrink-0 font-medium text-fd-foreground transition-colors hover:text-brand"
    >
      Log in
    </a>
  );
}
