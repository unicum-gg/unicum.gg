"use client";

import { useTranslation } from "@/hooks/use-translation";
import { DiscordLogoIcon, LockIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "@/hooks/use-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { LoginButton } from "@/components/login-button";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const MIN_EUR = 3;
const PRESETS = [3, 5, 10, 20, 50, 100] as const;

type MeStatus = {
  enabled: boolean;
  isSupporter: boolean;
  anonymous: boolean;
  discordRoleEnabled: boolean;
  discordLinked: boolean;
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
 */
export function SupportBox() {
  const { t } = useTranslation("components/support/support-box");
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<MeStatus | null>(null);
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/support/me")
      .then((r) => r.json())
      .then((d: MeStatus) => alive && setStatus(d))
      .catch(
        () =>
          alive &&
          setStatus({
            enabled: true,
            isSupporter: false,
            anonymous: false,
            discordRoleEnabled: false,
            discordLinked: false,
          }),
      );
    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s === "success")
      toast.success(`Thank you for supporting ${APP.NAME}!`);
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

  async function subscribe() {
    const eur = Number(amount);
    if (!Number.isFinite(eur) || eur < MIN_EUR) {
      toast.error(`Minimum is €${MIN_EUR} / month.`);
      return;
    }
    setBusy(true);
    try {
      const { url } = await postJson("/api/stripe/checkout", {
        amountCents: Math.round(eur * 100),
      });
      if (typeof url === "string") window.location.href = url;
    } catch {
      toast.error(t("could-not-start-checkout-please-try-again"));
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
      // The podium is server-rendered in the parent page, so re-render the
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
        {t("support-subscriptions-are-coming-soon")}</p>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-muted-foreground">
          {t("log-in-with-wargaming-to", { NAME: APP.NAME })}</p>
        <LoginButton callbackURL={ROUTES.SUPPORT}>
          <Button>{t("log-in-with-wargaming")}</Button>
        </LoginButton>
      </div>
    );
  }

  if (status?.isSupporter) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm">
          {t("you-are-a-supporter-thank", { NAME: APP.NAME })}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{t("show-me-anonymously-on-the")}</span>
          <Switch
            checked={status.anonymous}
            onCheckedChange={toggleAnonymous}
          />
        </div>
        {status.discordRoleEnabled && (
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/api/connect/discord";
            }}
          >
            <DiscordLogoIcon className="size-4" />
            {status.discordLinked
              ? t("re-sync-discord-role")
              : t("claim-your-supporter-role-on-discord")}
          </Button>
        )}
        <Button variant="secondary" onClick={manage} disabled={busy}>
          {busy ? <Spinner /> : t("manage-subscription")}
        </Button>
      </div>
    );
  }

  const eur = Number(amount);
  const valid = Number.isFinite(eur) && eur >= MIN_EUR;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-fd-muted-foreground">
        <span className="font-semibold text-fd-foreground">
          {t("pay-what-you-want")}</span>{" "}
        {t("pick-an-amount", { min: MIN_EUR })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
              eur === p
                ? "border-brand bg-brand/10 text-brand"
                : "border-fd-border text-fd-muted-foreground hover:bg-fd-border/40",
            )}
          >
            €{p}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="support-amount"
          className="text-xs uppercase tracking-wide text-fd-muted-foreground"
        >
          {t("or-choose-your-own-amount")}</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fd-muted-foreground">
            €
          </span>
          <Input
            id="support-amount"
            type="number"
            min={MIN_EUR}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7 tabular-nums"
          />
        </div>
      </div>

      <Button className="w-full" onClick={subscribe} disabled={busy || !valid}>
        {busy ? (
          <Spinner />
        ) : valid ? (
          `Support with €${eur}/month`
        ) : (
          `Minimum €${MIN_EUR}/month`
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-fd-muted-foreground">
        <LockIcon className="size-3.5" />
        {t("secured-by-stripe")}
      </div>
    </div>
  );
}
