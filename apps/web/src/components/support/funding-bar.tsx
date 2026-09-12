"use client";

import { Interpolate } from "@/components/interpolate";
import { useTranslation } from "@/hooks/use-translation";
import { useFormat } from "@/hooks/use-format";
import { fundingProgress, PROJECT_START } from "@unicum.gg/shared";
import type { InfraCosts } from "@/components/coverage/cost-breakdown";
import APP from "@/constants/app";
import { useMoney } from "@/hooks/use-money";

const PROJECT_START_PATTERN = "d MMMM yyyy" /* UTC */;

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
 * Everything here is euros: that is what the host invoices and what supporters
 * pay, so the whole computation stays in one currency and only the rendering
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
  const { t } = useTranslation("components/support/funding-bar");
  const money = useMoney();
  const { date } = useFormat();
  const {
    daysRunning,
    goalEur: spentSoFarEur,
    pct,
  } = fundingProgress(costs, receivedEur, nowMs);
  const monthlyCostEur = costs.totalAnnualEur / 12;
  const gapEur = Math.max(0, spentSoFarEur - receivedEur);
  const monthlyGapEur = Math.max(0, monthlyCostEur - monthlyPledgedEur);
  const supporters = t(
    supporterCount === 1 ? "from-supporter-one" : "from-supporters",
    { count: supporterCount },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 divide-x divide-fd-border rounded-lg border border-fd-border">
        <Stat
          label={t("raised-label")}
          value={money.format(receivedEur)}
          sub={supporters}
        />
        <Stat
          label={t("spent-since-launch")}
          value={money.format(spentSoFarEur)}
          sub={t("days-out-of-pocket", { days: daysRunning })}
        />
        <Stat
          label={t("covered-label")}
          value={`${pct}%`}
          sub={t("of-that-total")}
          accent
        />
      </div>

      <div>
        <div className="relative h-6 w-full overflow-hidden rounded-md bg-fd-border/50">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-fd-muted-foreground">
          <span>{t("raised-amount", { amount: money.format(receivedEur) })}</span>
          <span>{t("goal", { amount: money.format(spentSoFarEur) })}</span>
        </div>
      </div>

      <p className="text-sm text-fd-muted-foreground">
        {t("run-at-a-loss", {
          name: APP.NAME,
          since: date(PROJECT_START_PATTERN).format(PROJECT_START),
        })}{" "}
        <Interpolate
          template={t("covered-sentence")}
          values={{
            received: (
              <span className="font-semibold text-fd-foreground">
                {money.format(receivedEur)}
              </span>
            ),
            spent: (
              <span className="font-semibold text-fd-foreground">
                {money.format(spentSoFarEur)}
              </span>
            ),
          }}
        />{" "}
        {gapEur > 0
          ? t("to-catch-up", { amount: money.format(gapEur) })
          : t("caught-up")}
      </p>

      <p className="text-xs text-fd-muted-foreground">
        {t("run-rate", {
          pledged: money.format(monthlyPledgedEur),
          cost: money.format(monthlyCostEur),
        })}{" "}
        {monthlyGapEur > 0
          ? t("gap-growing", { amount: money.format(monthlyGapEur) })
          : t("pledges-cover")}
      </p>
    </div>
  );
}
