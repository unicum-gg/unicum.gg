"use client";

import { fundingProgress, PROJECT_START } from "@unicum.gg/shared";
import type { InfraCosts } from "@/components/coverage/cost-breakdown";
import APP from "@/constants/app";
import { useMoney } from "@/hooks/use-money";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
      <span className="text-[11px] uppercase tracking-wide text-fd-muted-foreground">
        {label}
      </span>
      <span
        className={
          accent
            ? "font-heading text-2xl font-bold tabular-nums text-brand"
            : "font-heading text-2xl font-bold tabular-nums"
        }
      >
        {value}
      </span>
      <span className="text-[11px] text-fd-muted-foreground">{sub}</span>
    </div>
  );
}

/**
 * The funding block. The bar is cumulative: it measures the total received from
 * supporters against the total spend since launch (every charge that has
 * actually been taken, plus every one-off), so it answers "how much of what we
 * have already paid out of pocket has the community covered". It steps up on
 * each billing date rather than creeping daily, because that is when the money
 * leaves. A secondary line shows the monthly run-rate.
 *
 * Everything here is euros: that is what OVH invoices and what supporters pay,
 * so the whole computation stays in one currency and only the rendering
 * converts. `nowMs` comes from the server parent so the client renders the same
 * figures the prerendered HTML did.
 */
export function FundingBar({
  costs,
  monthlyPledgedEur,
  receivedEur,
  supporterCount,
  nowMs,
}: {
  costs: InfraCosts;
  monthlyPledgedEur: number;
  receivedEur: number;
  supporterCount: number;
  nowMs: number;
}) {
  const money = useMoney();
  const {
    daysRunning,
    goalEur: spentSoFarEur,
    pct,
  } = fundingProgress(costs, receivedEur, nowMs);
  const monthlyCostEur = costs.totalAnnualEur / 12;
  const gapEur = Math.max(0, spentSoFarEur - receivedEur);
  const monthlyGapEur = Math.max(0, monthlyCostEur - monthlyPledgedEur);
  const supporters = `${supporterCount} supporter${supporterCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 divide-x divide-fd-border rounded-lg border border-fd-border">
        <Stat
          label="Raised"
          value={money.format(receivedEur)}
          sub={`from ${supporters}`}
        />
        <Stat
          label="Spent since launch"
          value={money.format(spentSoFarEur)}
          sub={`${daysRunning} days, out of pocket`}
        />
        <Stat label="Covered" value={`${pct}%`} sub="of that total" accent />
      </div>

      <div>
        <div className="relative h-6 w-full overflow-hidden rounded-md bg-fd-border/50">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-fd-muted-foreground">
          <span>{money.format(receivedEur)} raised</span>
          <span>goal {money.format(spentSoFarEur)}</span>
        </div>
      </div>

      <p className="text-sm text-fd-muted-foreground">
        {APP.NAME} has run at a loss since {dateFmt.format(PROJECT_START)}.
        Supporters have covered{" "}
        <span className="font-semibold text-fd-foreground">
          {money.format(receivedEur)}
        </span>{" "}
        of the{" "}
        <span className="font-semibold text-fd-foreground">
          {money.format(spentSoFarEur)}
        </span>{" "}
        spent so far.{" "}
        {gapEur > 0
          ? `${money.format(gapEur)} to fully catch up.`
          : "Fully caught up, thank you. Everything extra goes into more throughput and new features."}
      </p>

      <p className="text-xs text-fd-muted-foreground">
        Monthly run-rate: {money.format(monthlyPledgedEur)}/mo pledged vs{" "}
        {money.format(monthlyCostEur)}/mo to run.
        {monthlyGapEur > 0
          ? ` ${money.format(monthlyGapEur)}/mo more stops the gap from growing.`
          : " Pledges now cover the monthly bill."}
      </p>
    </div>
  );
}
