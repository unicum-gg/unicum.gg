"use client";

import { UserGearIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { AuthProvider } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { ConnectionsDialog } from "@/components/account/connections-dialog";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTranslation } from "@/hooks/use-translation";
import { authClient, useSession } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";

/**
 * Connected accounts, on the one page a player already thinks of as theirs.
 *
 * A button beside Compare and the overflow menu rather than an entry inside the
 * menu, because connecting is already offered in several places across the site
 * and disconnecting was offered in none: a reader looking for it has to find it
 * without being told where, and a `⋯` is where things go that a reader is not
 * expected to look for. Same chrome as `CompareWithButton` next to it, so the
 * row stays one row of controls rather than one control and a special case.
 *
 * Only on your own profile. It reads nothing and renders nothing on anybody
 * else's, so the millions of player pages that are not yours cost nothing.
 *
 * Gated on hydration, which is not caution: the auth client can resolve the
 * session synchronously on the very first client render (it caches it), while
 * the server rendered with none. React then aligns this new button against the
 * server's next sibling, the overflow menu, and regenerates the whole header
 * with a hydration error. `AddChannelCta` carries the same gate for the same
 * collision.
 */
export function PlayerConnectionsButton({
  region,
  accountId,
}: {
  region: Region;
  accountId: number;
}) {
  const { t } = useTranslation("components/players/detail/connections-button");
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);

  const wg = wgIdentityFromEmail(session?.user?.email);
  const isOwnProfile = wg?.region === region && wg?.accountId === accountId;

  // The nudge: an orange dot while Twitch is unconnected, which is what used to
  // live on the overflow menu. `listAccounts` rather than `/api/account/me`,
  // which this dialog reads when it opens: that one resolves the channel name
  // and the Discord handle from their own APIs, and a dot needs neither.
  const [twitchLinked, setTwitchLinked] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isOwnProfile) return;
    let cancelled = false;
    authClient
      .listAccounts()
      .then((res) => {
        if (!cancelled) {
          setTwitchLinked(
            (res.data ?? []).some((a) => a.providerId === AuthProvider.Twitch),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile]);

  if (!hydrated || !isOwnProfile) return null;
  const needsTwitch = twitchLinked === false;

  return (
    <>
      {/* `title` + `aria-label` rather than a `Tooltip`, matching the overflow
          menu it sits beside: the two are one row of controls and should not
          behave differently on hover. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("connected-accounts")}
        aria-label={t("connected-accounts")}
        className="relative inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
      >
        <UserGearIcon className="size-3.5" weight="bold" />
        {needsTwitch ? (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-fd-background" />
        ) : null}
      </button>

      {/* This page is where a connect round trip comes back to, so this is the
          mount that reads the flag and reopens. */}
      <ConnectionsDialog open={open} onOpenChange={setOpen} reopenOnReturn />
    </>
  );
}
