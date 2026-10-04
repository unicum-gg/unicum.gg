"use client";

import { LockIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import {
  SUPPORT_MIN_CENTS,
  SUPPORT_PRESETS_EUR,
  SupportMode,
} from "@unicum.gg/shared";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const MIN_EUR = SUPPORT_MIN_CENTS / 100;

/**
 * The amount picker and the button that opens Checkout, in whichever modes the
 * caller offers.
 *
 * The amount is typed in euros because that is what Stripe collects and what
 * the host invoices us: every other money figure on the page is converted to
 * the reader's currency at the live rate, and converting this one would show a
 * price we are not about to charge.
 *
 * A one-off donation and a monthly pledge share this whole form (same floor,
 * same presets, same free field) because they differ in one thing only, whether
 * the charge repeats. Which is also why the mode is a switch above the amount
 * rather than a second block below it: the amount is the question either way.
 */
export function SupportForm({
  modes,
  busy,
  onCheckout,
}: {
  /** The modes to offer, first one preselected. A single mode hides the switch. */
  modes: SupportMode[];
  busy: boolean;
  onCheckout: (mode: SupportMode, amountCents: number) => void;
}) {
  const { t } = useTranslation("components/support/support-form");
  const [mode, setMode] = useState(modes[0] ?? SupportMode.Monthly);
  const [amount, setAmount] = useState("5");

  const eur = Number(amount);
  const valid = Number.isFinite(eur) && eur >= MIN_EUR;
  const once = mode === SupportMode.OneOff;
  // Spelled out rather than built from the mode, so every key the form can
  // render is greppable in the dictionary it comes from.
  const cta = valid
    ? once
      ? t("give-once", { amount: `€${eur}` })
      : t("support-with-monthly", { amount: `€${eur}` })
    : once
      ? t("minimum-once", { amount: `€${MIN_EUR}` })
      : t("minimum-monthly", { amount: `€${MIN_EUR}` });

  return (
    <div className="flex flex-col gap-4">
      {modes.length > 1 && (
        <SegmentedControl
          className="self-center"
          segments={modes.map((id) => ({
            id,
            label: t(id === SupportMode.OneOff ? "one-time" : "monthly"),
          }))}
          active={mode}
          onSelect={setMode}
        />
      )}

      <p className="text-center text-sm text-fd-muted-foreground">
        <span className="font-semibold text-fd-foreground">
          {t("pay-what-you-want")}
        </span>{" "}
        {t(once ? "pick-an-amount-once" : "pick-an-amount-monthly", {
          min: MIN_EUR,
        })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {SUPPORT_PRESETS_EUR.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(String(preset))}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
              eur === preset
                ? "border-brand bg-brand/10 text-brand"
                : "border-fd-border text-fd-muted-foreground hover:bg-fd-border/40",
            )}
          >
            €{preset}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="support-amount"
          className="text-xs uppercase tracking-wide text-fd-muted-foreground"
        >
          {t("or-choose-your-own-amount")}
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

      <Button
        className="w-full"
        onClick={() => onCheckout(mode, Math.round(eur * 100))}
        disabled={busy || !valid}
      >
        {busy ? <Spinner /> : cta}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-fd-muted-foreground">
        <LockIcon className="size-3.5" />
        {t(once ? "secured-by-stripe-once" : "secured-by-stripe-monthly")}
      </div>
    </div>
  );
}
