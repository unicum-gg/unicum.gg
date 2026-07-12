"use client";

import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRegion } from "@/hooks/use-region";
import ROUTES from "@/constants/routes";
import { wgIdentityFromEmail } from "@/lib/wg-session";

/**
 * Top-bar Wargaming.net ID login, styled after WG's own discreet top-right
 * link. Logged out: a "Log in" link that kicks off the WG OpenID redirect for
 * the current region. Logged in: the nickname (linking to the player's own
 * profile, where account actions like connecting Twitch live) plus a log out.
 */
export function LoginWidget() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();

  if (isPending) {
    return <span className="shrink-0 text-fd-muted-foreground">—</span>;
  }

  if (session?.user) {
    const wg = wgIdentityFromEmail(session.user.email);
    const profileHref = wg
      ? ROUTES.PLAYER(wg.region, session.user.name)
      : null;
    return (
      <span className="flex shrink-0 items-center gap-2">
        {profileHref ? (
          <Link
            href={profileHref}
            className="font-medium tabular-nums text-[#f25322] hover:underline"
          >
            {session.user.name}
          </Link>
        ) : (
          <span className="font-medium tabular-nums text-[#f25322]">
            {session.user.name}
          </span>
        )}
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
      href={`/api/auth/sign-in/wargaming?region=${region}`}
      className="shrink-0 font-medium text-fd-foreground transition-colors hover:text-[#f25322]"
    >
      Log in
    </a>
  );
}
