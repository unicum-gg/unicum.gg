import APP from "@/constants/app";
import { PROJECT_START, fundingProgress } from "@/lib/funding";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
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
 * supporters against the total infrastructure spend since launch (a target that
 * grows every day), so it answers "how much of what we have already paid out of
 * pocket has the community covered". A secondary line shows the monthly run-rate.
 * Server-rendered, so the "now"-based figures are computed fresh per request.
 */
export function FundingBar({
  monthlyCostUsd,
  monthlyPledgedUsd,
  receivedUsd,
  supporterCount,
}: {
  monthlyCostUsd: number;
  monthlyPledgedUsd: number;
  receivedUsd: number;
  supporterCount: number;
}) {
  // Cumulative spend since launch (`goalUsd`) is the bar's target.
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request; a fresh "now" is intended so the figures advance over time
  const nowMs = Date.now();
  const {
    daysRunning,
    goalUsd: spentSoFarUsd,
    pct,
  } = fundingProgress(monthlyCostUsd, receivedUsd, nowMs);
  const gapUsd = Math.max(0, spentSoFarUsd - receivedUsd);
  const monthlyGapUsd = Math.max(0, monthlyCostUsd - monthlyPledgedUsd);
  const supporters = `${supporterCount} supporter${supporterCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 divide-x divide-fd-border rounded-lg border border-fd-border">
        <Stat
          label="Raised"
          value={usdFmt.format(receivedUsd)}
          sub={`from ${supporters}`}
        />
        <Stat
          label="Spent since launch"
          value={usdFmt.format(spentSoFarUsd)}
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
          <span>{usdFmt.format(receivedUsd)} raised</span>
          <span>goal {usdFmt.format(spentSoFarUsd)}</span>
        </div>
      </div>

      <p className="text-sm text-fd-muted-foreground">
        {APP.NAME} has run at a loss since {dateFmt.format(PROJECT_START)}.
        Supporters have covered{" "}
        <span className="font-semibold text-fd-foreground">
          {usdFmt.format(receivedUsd)}
        </span>{" "}
        of the{" "}
        <span className="font-semibold text-fd-foreground">
          {usdFmt.format(spentSoFarUsd)}
        </span>{" "}
        spent so far.{" "}
        {gapUsd > 0
          ? `${usdFmt.format(gapUsd)} to fully catch up.`
          : "Fully caught up, thank you. Everything extra goes into more throughput and new features."}
      </p>

      <p className="text-xs text-fd-muted-foreground">
        Monthly run-rate: {usdFmt.format(monthlyPledgedUsd)}/mo pledged vs{" "}
        {usdFmt.format(monthlyCostUsd)}/mo to run.
        {monthlyGapUsd > 0
          ? ` ${usdFmt.format(monthlyGapUsd)}/mo more stops the gap from growing.`
          : " Pledges now cover the monthly bill."}
      </p>
    </div>
  );
}
