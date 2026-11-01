"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import { useAccount } from "@/hooks/use-account";
import { useFormat } from "@/hooks/use-format";
import { useMoney } from "@/hooks/use-money";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsRow } from "./settings-row";
import { SettingsSkeleton } from "./settings-skeleton";

/**
 * What this account gives the site, and the way to change it.
 *
 * Only what we hold is shown: the monthly support while it runs (and, once
 * cancelled, the day it stops) and everything given so far. Payment methods,
 * invoices and the cancellation itself stay in Stripe's portal, which the
 * button opens: copying them here would be a second place for billing to be
 * wrong. The portal sends the reader back to this very section.
 */
export function SettingsBilling() {
  const { t } = useTranslation("components/account/settings");
  const { data: state } = useAccount();
  const money = useMoney();
  const { date } = useFormat();
  const [opening, setOpening] = useState(false);

  if (!state) return <SettingsSkeleton rows={2} />;
  const billing = state.billing;
  if (!billing) return null;
  const pledge = billing.pledge;

  async function openPortal() {
    setOpening(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          returnPath: `${window.location.pathname}${window.location.search}#settings/billing`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: unknown };
      if (!res.ok || typeof data.url !== "string") throw new Error();
      window.location.href = data.url;
    } catch {
      toast.error(t("billing-portal-failed"));
      setOpening(false);
    }
  }

  const periodEnd = pledge?.currentPeriodEnd
    ? date("d MMMM yyyy").format(pledge.currentPeriodEnd)
    : null;

  return (
    <div>
      {pledge ? (
        <SettingsRow
          label={t("billing-pledge", {
            amount: money.format(pledge.amountCents / 100),
          })}
          description={
            periodEnd
              ? t(pledge.cancelAtPeriodEnd ? "billing-ends" : "billing-renews", {
                  date: periodEnd,
                })
              : undefined
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={openPortal}
            disabled={opening}
          >
            {t("billing-manage")}
          </Button>
        </SettingsRow>
      ) : (
        <SettingsRow
          label={t("billing-none")}
          description={t("billing-none-description")}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.SUPPORT}>{t("billing-support")}</Link>
          </Button>
        </SettingsRow>
      )}
      {billing.contributedCents > 0 ? (
        <SettingsRow
          label={t("billing-total")}
          description={t("billing-total-description")}
        >
          <span className="text-sm font-medium tabular-nums text-fd-foreground">
            {money.format(billing.contributedCents / 100)}
          </span>
        </SettingsRow>
      ) : null}
    </div>
  );
}
