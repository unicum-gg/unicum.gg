"use client";

import { LockIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const MIN_EUR = 3;
const PRESETS = [3, 5, 10, 20, 50, 100] as const;

type MeStatus = { enabled: boolean; isSupporter: boolean; anonymous: boolean };

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
  const { data: session, isPending } = useSession();
  const { region } = useRegion();
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
          setStatus({ enabled: true, isSupporter: false, anonymous: false }),
      );
    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s === "success")
      toast.success(`Thank you for supporting ${APP.NAME}!`);
    if (s === "canceled") toast("Checkout canceled.");
    if (s) window.history.replaceState({}, "", ROUTES.SUPPORT);
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
      toast.error("Could not start checkout. Please try again.");
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
      toast.error("Could not open the billing portal.");
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
      toast.error("Could not update your preference.");
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
        Support subscriptions are coming soon.
      </p>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-muted-foreground">
          Log in with Wargaming to support {APP.NAME}.
        </p>
        <Button asChild>
          <a href={ROUTES.AUTH_SIGN_IN(region, ROUTES.SUPPORT)}>
            Log in with Wargaming
          </a>
        </Button>
      </div>
    );
  }

  if (status?.isSupporter) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm">
          You are a supporter. Thank you for keeping {APP.NAME} alive.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Show me anonymously on the podium</span>
          <Switch
            checked={status.anonymous}
            onCheckedChange={toggleAnonymous}
          />
        </div>
        <Button variant="secondary" onClick={manage} disabled={busy}>
          {busy ? <Spinner /> : "Manage subscription"}
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
          Pay what you want.
        </span>{" "}
        Pick an amount or type your own, from €{MIN_EUR}/month.
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
          Or choose your own amount
        </label>
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
        Secured by Stripe. Cancel anytime.
      </div>
    </div>
  );
}
