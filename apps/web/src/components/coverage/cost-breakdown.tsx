"use client";

import type { ExpenseLedger } from "@unicum.gg/shared";
import { useMoney } from "@/hooks/use-money";

const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const rangeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
  const money = useMoney();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          Estimated annual cost
        </div>
        <div className="font-heading text-4xl font-bold tabular-nums text-brand">
          {money.format(costs.totalAnnualEur, 2)}
        </div>
        <div className="text-sm text-fd-muted-foreground">
          A fixed {money.format(costs.totalAnnualEur / 12, 2)}/month bill, no
          surprises: one rented server, no third-party SaaS in the data path. It
          only grows when we outgrow the server (more Wargaming throughput means
          more egress IPs).
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
          Cost breakdown
        </div>
        <ul className="divide-y divide-fd-border text-sm">
          {costs.recurring.map((line) => (
            <li
              key={line.label}
              className="flex items-start justify-between gap-4 py-2"
            >
              <span>
                <span className="text-fd-foreground">{line.label}</span>
                {line.note && (
                  <span className="block text-xs text-fd-muted-foreground">
                    {line.note}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                {line.eurAnnual > 0 ? money.format(line.eurAnnual, 2) : "free"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {costs.past.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
            Previously
          </div>
          <ul className="divide-y divide-fd-border text-sm">
            {costs.past.map((line) => (
              <li
                key={`${line.label}-${line.from}`}
                className="flex items-start justify-between gap-4 py-2"
              >
                <span>
                  <span className="text-fd-foreground">{line.label}</span>
                  <span className="block text-xs text-fd-muted-foreground">
                    {rangeFmt.formatRange(
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
            One-off spend
          </div>
          <ul className="divide-y divide-fd-border text-sm">
            {costs.oneOff.map((line) => (
              <li
                key={`${line.label}-${line.incurredAt}`}
                className="flex items-start justify-between gap-4 py-2"
              >
                <span>
                  <span className="text-fd-foreground">{line.label}</span>
                  <span className="block text-xs text-fd-muted-foreground">
                    {monthFmt.format(new Date(line.incurredAt))}
                    {line.note ? ` · ${line.note}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{money.format(line.eur, 2)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fd-muted-foreground">
            Paid once, so it is not part of the monthly bill above. It still
            counts toward what the project has cost so far.
          </p>
        </div>
      )}
      {money.converted && (
        <p className="text-xs text-fd-muted-foreground">
          {`Billed in euros, converted to ${money.currency} at today's rate.`}
        </p>
      )}
    </div>
  );
}
