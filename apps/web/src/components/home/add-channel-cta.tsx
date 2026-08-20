"use client";

import { TwitchLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRegion } from "@/hooks/use-region";
import { authClient, useSession } from "@/lib/auth-client";

/**
 * CTA in the "streaming now" rail inviting WoT streamers to get listed. Shown to
 * anyone who can't be listed yet:
 *  - logged out → starts the Wargaming.net ID login (they link Twitch after);
 *  - logged in without Twitch → starts the Twitch OAuth link directly.
 * Hidden once the account already has Twitch linked (nothing left to add).
 */
export function AddChannelCta() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();
  const loggedIn = !!session?.user;

  // The session can already be resolved on the very first client render (read
  // synchronously from the auth client cache), while the server rendered with no
  // session. Gate on hydration so the first client render matches the server
  // (nothing) and the auth-dependent output only appears after it, avoiding a
  // mismatch with the sibling controls in the streamers header.
  const hydrated = useHydrated();

  // Whether the logged-in account already has a Twitch account linked.
  const [twitchLinked, setTwitchLinked] = useState<boolean | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
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
  }, [loggedIn]);

  // Wait for hydration and the session before deciding, and drop out once linked.
  if (!hydrated || isPending) return null;
  if (loggedIn && twitchLinked === true) return null;

  const label = (
    <>
      <TwitchLogoIcon weight="bold" className="mr-1.5 size-4" />
      Add your channel
    </>
  );

  // Logged in but no Twitch yet → link it right here.
  if (loggedIn) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() =>
          authClient.linkSocial({ provider: "twitch", callbackURL: "/" })
        }
      >
        {label}
      </Button>
    );
  }

  // Logged out → WG login (proves they own the account), then land on the
  // `/api/connect/twitch` endpoint which chains straight into the Twitch link.
  return (
    <Button asChild variant="outline" size="sm" className="shrink-0">
      <a href={ROUTES.AUTH_SIGN_IN(region, "/api/connect/twitch")}>{label}</a>
    </Button>
  );
}
