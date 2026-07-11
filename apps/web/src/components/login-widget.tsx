"use client";

import { signOut, useSession } from "@/lib/auth-client";
import { useRegion } from "@/hooks/use-region";

/**
 * Top-bar Wargaming.net ID login, styled after WG's own discreet top-right
 * link. Logged out: a "Log in" link that kicks off the WG OpenID redirect for
 * the current region. Logged in: just the nickname, with a subtle log out.
 */
export function LoginWidget() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();

  if (isPending) {
    return <span className="shrink-0 text-fd-muted-foreground">—</span>;
  }

  if (session?.user) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-medium tabular-nums text-[#f25322]">
          {session.user.name}
        </span>
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
