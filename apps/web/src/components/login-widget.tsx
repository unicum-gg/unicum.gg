"use client";

import { GearSixIcon } from "@phosphor-icons/react";
import Link from "@/components/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { LoginButton } from "@/components/login-button";
import { SettingsDialog } from "@/components/account/settings-dialog";
import ROUTES from "@/constants/routes";
import { unicum } from "@/services/sdk";
import { useTranslation } from "@/hooks/use-translation";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { Hint } from "@/components/hint";

type UserClanTag = { tag: string; name: string; color: string };

/**
 * Top-bar Wargaming.net ID login, styled after WG's own discreet top-right
 * link. Logged out: a "Log in" link that opens the region picker, which is
 * where the WG OpenID redirect is started from. Logged in: the nickname
 * (linking to the player's own profile), their current clan tag, plus the way
 * into the account's settings.
 *
 * Settings rather than the log out that used to sit here. Signing out is the
 * one account action a reader performs deliberately and almost never, so it
 * moved inside the dialog, and what takes its place opens everything the
 * account can change. The dialog is deliberately NOT the one claiming the
 * OAuth return flag: this widget is on every page, and two mounts claiming it
 * would both open at once on the pages that already have their own.
 */
export function LoginWidget() {
  const { t } = useTranslation("components/login-widget");
  const { data: session, isPending } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    // The nickname is the one thing here with no bound: a player names
    // themselves, and the top strip is the same 36 pixels on a phone as on a
    // desktop. So it is what gives way first, truncating rather than pushing
    // the tag and the log out off the edge, which is what it did.
    const name = (
      <span className="flex min-w-0 items-baseline gap-1">
        {profileHref ? (
          <Link
            href={profileHref}
            className="truncate font-medium tabular-nums text-fd-foreground hover:underline"
          >
            {session.user.name}
          </Link>
        ) : (
          <span className="truncate font-medium tabular-nums text-fd-foreground">
            {session.user.name}
          </span>
        )}
        {clanTag &&
          (wg ? (
            <Link
              href={ROUTES.CLAN(wg.region, clanTag.tag)}
              className="shrink-0 tabular-nums text-fd-foreground hover:underline"
            >
              <ClanTag tag={clanTag.tag} color={clanTag.color} />
            </Link>
          ) : (
            <span className="shrink-0 tabular-nums text-fd-foreground">
              <ClanTag tag={clanTag.tag} color={clanTag.color} />
            </span>
          ))}
      </span>
    );
    return (
      <span className="flex min-w-0 items-center gap-2">
        {name}
        <Hint content={t("settings")}>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t("settings")}
            className="shrink-0 cursor-pointer text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            {/* An icon on a phone, where the words would cost a third of the
                strip. The label stays the accessible name either way. */}
            <span className="hidden sm:inline">{t("settings")}</span>
            <GearSixIcon className="size-4 sm:hidden" aria-hidden />
          </button>
        </Hint>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          claimHash
        />
      </span>
    );
  }

  return (
    <LoginButton>
      <button
        type="button"
        className="shrink-0 cursor-pointer font-medium text-fd-foreground transition-colors hover:text-brand"
      >
        {t("login")}
      </button>
    </LoginButton>
  );
}
