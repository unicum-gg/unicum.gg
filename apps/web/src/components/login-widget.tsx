"use client";

import { AccountMenu } from "@/components/account/account-menu";
import { LoginButton } from "@/components/login-button";
import { useTranslation } from "@/hooks/use-translation";
import { useSession } from "@/lib/auth-client";

/**
 * Top-bar Wargaming.net ID login, styled after WG's own discreet top-right
 * link. Logged out: a "Log in" link that opens the region picker, which is
 * where the WG OpenID redirect is started from. Logged in: the account menu
 * (profile, clan, settings, the other accounts signed in on this browser, and
 * signing out).
 */
export function LoginWidget() {
  const { t } = useTranslation("components/login-widget");
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <span className="shrink-0 text-fd-muted-foreground">—</span>;
  }

  if (session?.user) {
    return <AccountMenu active={session} />;
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
