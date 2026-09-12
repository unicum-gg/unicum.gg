"use client";

import { statLabel } from "@/components/stat-label";

import { useTranslation } from "@/hooks/use-translation";
import { useFormat } from "@/hooks/use-format";
import type { ExpenseLedger } from "@unicum.gg/shared";
import { useMoney } from "@/hooks/use-money";

const MONTH_PATTERN = "MMMM yyyy" /* UTC */;
const RANGE_PATTERN = "d MMM yyyy" /* UTC */;

export type InfraCosts = ExpenseLedger;

/**
 * The cost story: the annual total of what is billed today, its monthly run
 * rate, the per-line breakdown, then what used to be billed and what was paid
 * once. Shared by the coverage page (full transparency) and the support page
 * (the reason we ask for help).
 *
 * The closed lines are worth showing rather than dropping: they are why the
 * "spent since launch" figure is not simply today's rate times the days it has
 * run — the site started on a much smaller machine.
 *
 * Every amount arrives in euros (what the host and the rest actually invoice)
 * and is converted here, at the live rate, into the visitor's regional
 * currency.
 * That is a client concern: these pages are prerendered, so the region (and
 * therefore the currency) is only known in the browser.
 */
export function CostBreakdown({ costs }: { costs: InfraCosts }) {
  const { t: tStats } = useTranslation("components/stat-labels");
  const { date } = useFormat();
  const { t } = useTranslation("components/coverage/cost-breakdown");
  const money = useMoney();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          {t("estimated-annual-cost")}</div>
        <div className="font-heading text-4xl font-bold tabular-nums text-brand">
          {money.format(costs.totalAnnualEur, 2)}
        </div>
        <div className="text-sm text-fd-muted-foreground">
          {t("fixed-month-bill-no-surprises", { totalAnnualEur: money.format(costs.totalAnnualEur / 12, 2) })}</div>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          {t("cost-breakdown")}</div>
        <ul className="divide-y divide-fd-border text-sm">
          {costs.recurring.map((line) => (
            <li
              key={line.label}
              className="flex items-start justify-between gap-4 py-2"
            >
              <span>
                <span className="text-fd-foreground">{statLabel(line.label, tStats)}</span>
                {line.note && (
                  <span className="block text-xs text-fd-muted-foreground">
                    {line.note}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                {line.eurAnnual > 0 ? money.format(line.eurAnnual, 2) : t("free")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {costs.past.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
            {t("previously")}</div>
          <ul className="divide-y divide-fd-border text-sm">
            {costs.past.map((line) => (
              <li
                key={`${line.label}-${line.from}`}
                className="flex items-start justify-between gap-4 py-2"
              >
                <span>
                  <span className="text-fd-foreground">{statLabel(line.label, tStats)}</span>
                  <span className="block text-xs text-fd-muted-foreground">
                    {date(RANGE_PATTERN).formatRange(
                      new Date(line.from),
                      new Date(line.to ?? line.from),
                    )}
                    {line.note ? ` · ${line.note}` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {`${money.format(line.eurPerCharge, 2)}${
                    line.chargesPerYear === 12 ? "/mo" : "/yr"
                  }`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {costs.oneOff.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
            {t("one-off-spend")}</div>
          <ul className="divide-y divide-fd-border text-sm">
            {costs.oneOff.map((line) => (
              <li
                key={`${line.label}-${line.incurredAt}`}
                className="flex items-start justify-between gap-4 py-2"
              >
                <span>
                  <span className="text-fd-foreground">{statLabel(line.label, tStats)}</span>
                  <span className="block text-xs text-fd-muted-foreground">
                    {date(MONTH_PATTERN).format(new Date(line.incurredAt))}
                    {line.note ? ` · ${line.note}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{money.format(line.eur, 2)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fd-muted-foreground">
            {t("paid-once-so-it-is")}</p>
        </div>
      )}
      {money.converted && (
        <p className="text-xs text-fd-muted-foreground">
          {t("billed-in-euros", { currency: money.currency })}
        </p>
      )}
    </div>
  );
}
