"use client";

import { TwitchLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/hooks/use-region";
import { useSession } from "@/lib/auth-client";

/**
 * CTA in the "streaming now" rail inviting WoT streamers to get listed. Only
 * shown to logged-out visitors (the ones who can't add a channel yet): it kicks
 * off the Wargaming.net ID login, after which they link Twitch from their own
 * profile (the "Connect Twitch" action, nudged with an orange dot there).
 * Logged-in users already have that entry point, so nothing renders for them.
 */
export function AddChannelCta() {
  const { data: session, isPending } = useSession();
  const { region } = useRegion();

  if (isPending || session?.user) return null;

  return (
    <Button asChild variant="outline" size="sm" className="shrink-0">
      <a href={`/api/auth/sign-in/wargaming?region=${region}`}>
        <TwitchLogoIcon weight="bold" className="mr-1.5 size-4" />
        Add your channel
      </a>
    </Button>
  );
}
