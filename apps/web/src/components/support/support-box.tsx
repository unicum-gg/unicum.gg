"use client";

import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SupportMode } from "@unicum.gg/shared";
import { ConnectionsDialog } from "@/components/account/connections-dialog";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useMoney } from "@/hooks/use-money";
import { useRouter } from "@/hooks/use-router";
import { useTranslation } from "@/hooks/use-translation";
import { useSession } from "@/lib/auth-client";
import { SupportForm } from "./support-form";

type MeStatus = {
  enabled: boolean;
  isSupporter: boolean;
  anonymous: boolean;
  contributedCents: number;
  discordRoleEnabled: boolean;
  discordLinked: boolean;
};

const UNKNOWN: MeStatus = {
  enabled: true,
  isSupporter: false,
  anonymous: false,
  contributedCents: 0,
  discordRoleEnabled: false,
  discordLinked: false,
};

async function postJson(
  url: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? res.status));
  return data;
}

/**
 * The interactive support widget: reads the WG session + the user's support
 * status, then shows the right state (log in / pay-what-you-want checkout /
 * manage + anonymity toggle). Everything money-related is a plain action POST,
 * so this stays a small client island inside the server-rendered page.
 *
 * An active supporter is offered the one-off form but not the monthly one: a
 * second subscription is something only the billing portal should change (the
 * endpoint refuses it too), while giving extra on top is exactly what a single
 * payment is for. The anonymity switch follows what somebody has GIVEN rather
 * than whether they are subscribed, since that is what the board ranks.
 */
export function SupportBox() {
  const { t } = useTranslation("components/support/support-box");
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const money = useMoney();
  const [status, setStatus] = useState<MeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/support/me")
      .then((r) => r.json())
      .then((d: MeStatus) => alive && setStatus(d))
      .catch(() => alive && setStatus(UNKNOWN));
    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s === "success")
      toast.success(
        params.get("support") === SupportMode.OneOff
          ? t("thank-you-for-your-donation")
          : t("thank-you-for-supporting", { NAME: APP.NAME }),
      );
    if (s === "canceled") toast(t("checkout-canceled"));
    const claim = params.get("claim");
    if (claim === "ok") toast.success(t("supporter-role-added-on-discord"));
    if (claim === "not_supporter")
      toast.error(t("only-active-supporters-can-claim-the-discord"));
    if (claim === "error")
      toast.error(t("could-not-add-the-discord-role-please-try-ag"));
    if (s || claim) window.history.replaceState({}, "", ROUTES.SUPPORT);
    // Once, on arrival: the effect reads the query string the checkout came
    // back with and then strips it, so re-running it on a new `t` would be a
    // second toast about a redirect that already happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout(mode: SupportMode, amountCents: number) {
    setBusy(true);
    try {
      const { url } = await postJson("/api/stripe/checkout", {
        amountCents,
        mode,
      });
      if (typeof url === "string") window.location.href = url;
    } catch (err) {
      // The endpoint refuses a second monthly pledge, which a reader can reach
      // honestly: right after a successful checkout the webhook may not have
      // landed yet, so this box still shows them the monthly form.
      toast.error(
        err instanceof Error && err.message === "already_subscribed"
          ? t("you-already-have-a-monthly-pledge")
          : t("could-not-start-checkout-please-try-again"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    try {
      const { url } = await postJson("/api/stripe/portal");
      if (typeof url === "string") window.location.href = url;
    } catch {
      toast.error(t("could-not-open-the-billing-portal"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAnonymous(next: boolean) {
    setStatus((s) => (s ? { ...s, anonymous: next } : s));
    try {
      await postJson("/api/support/anonymous", { anonymous: next });
      // The board is server-rendered in the parent page, so re-render the
      // server tree to reflect the new name (real vs "Anonymous").
      router.refresh();
    } catch {
      setStatus((s) => (s ? { ...s, anonymous: !next } : s));
      toast.error(t("could-not-update-your-preference"));
    }
  }

  if (isPending || (session?.user && !status)) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (status && !status.enabled) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {t("support-subscriptions-are-coming-soon")}
      </p>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-muted-foreground">
          {t("log-in-with-wargaming-to", { NAME: APP.NAME })}
        </p>
        <LoginButton callbackURL={ROUTES.SUPPORT}>
          <Button>{t("log-in-with-wargaming")}</Button>
        </LoginButton>
      </div>
    );
  }

  const me = status ?? UNKNOWN;
  const contributed = me.contributedCents > 0;
  const anonymitySwitch = contributed ? (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{t("show-me-anonymously-on-the")}</span>
      <Switch checked={me.anonymous} onCheckedChange={toggleAnonymous} />
    </div>
  ) : null;

  if (me.isSupporter) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm">
          {t("you-are-a-supporter-thank", { NAME: APP.NAME })}
        </p>
        {anonymitySwitch}
        {me.discordRoleEnabled && (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = "/api/connect/discord";
              }}
            >
              <DiscordLogoIcon className="size-4" />
              {me.discordLinked
                ? t("re-sync-discord-role")
                : t("claim-your-supporter-role-on-discord")}
            </Button>
            {/* Claiming the role is offered here, so this is where somebody
                looks to undo it. */}
            {me.discordLinked && (
              <>
                <button
                  type="button"
                  onClick={() => setConnectionsOpen(true)}
                  className="cursor-pointer text-center text-xs text-fd-muted-foreground hover:text-fd-foreground hover:underline"
                >
                  {t("manage-connected-accounts")}
                </button>
                {/* Connecting from here leaves the site, so this mount reads
                    the flag the round trip comes back with. It is the only
                    connections dialog on this page, so nothing double-opens. */}
                <ConnectionsDialog
                  open={connectionsOpen}
                  onOpenChange={setConnectionsOpen}
                  reopenOnReturn
                />
              </>
            )}
          </div>
        )}
        <Button variant="secondary" onClick={manage} disabled={busy}>
          {busy ? <Spinner /> : t("manage-subscription")}
        </Button>
        <div className="flex flex-col gap-4 border-t border-fd-border pt-4">
          <p className="text-center text-sm font-semibold">
            {t("give-extra-one-time")}
          </p>
          <SupportForm
            modes={[SupportMode.OneOff]}
            busy={busy}
            onCheckout={checkout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SupportForm
        modes={[SupportMode.Monthly, SupportMode.OneOff]}
        busy={busy}
        onCheckout={checkout}
      />
      {contributed && (
        <div className="flex flex-col gap-4 border-t border-fd-border pt-4">
          <p className="text-center text-sm text-fd-muted-foreground">
            {t("you-have-given-so-far", {
              amount: money.format(me.contributedCents / 100),
            })}
          </p>
          {anonymitySwitch}
        </div>
      )}
    </div>
  );
}
