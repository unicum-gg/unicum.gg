"use client";

import { TwitchLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef } from "react";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { authClient, useSession } from "@/lib/auth-client";

/**
 * Resume point that chains Wargaming.net login straight into linking Twitch.
 * Reached as the sign-in `callbackURL`, so a logged-out streamer flows
 * login → Twitch OAuth in one go (no second click). If somehow reached logged
 * out, it bounces back through login and returns here.
 */
export default function ConnectTwitchPage() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();
  const started = useRef(false);

  useEffect(() => {
    if (isPending || started.current) return;
    started.current = true;
    if (!session?.user) {
      window.location.href = ROUTES.AUTH_SIGN_IN(region, ROUTES.CONNECT_TWITCH);
      return;
    }
    authClient.linkSocial({ provider: "twitch", callbackURL: "/" });
  }, [isPending, session?.user, region]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <TwitchLogoIcon
        weight="bold"
        className="size-10 animate-pulse text-[#9146ff]"
      />
      <p className="text-fd-muted-foreground">
        Connecting your Twitch channel…
      </p>
    </div>
  );
}
