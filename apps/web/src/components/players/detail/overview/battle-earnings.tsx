import type { TranslateFunction } from "@onruntime/translations";
import type { BattleEconomy } from "@unicum.gg/shared";
import { CurrencyIcon, type Currency } from "@/components/tanks/currency-icon";
import { cn } from "@/lib/utils";

/**
 * What a battle paid one player, summarised the way the game's results screen
 * does: a column for a standard account and one with the player's own bonuses,
 * a line per figure, the costs taken off each to give its own net. Read off the
 * player's own results; the itemised version is the detailed report.
 */
export function EarningsSummary({
  money,
  t,
  count,
}: {
  money: BattleEconomy;
  t: TranslateFunction;
  count: Intl.NumberFormat;
}) {
  const costs = (money.repairCost ?? 0) + (money.ammoCost ?? 0) + (money.suppliesCost ?? 0);
  const signed = (value: number | undefined) =>
    value === undefined ? undefined : value < 0 ? `-${count.format(-value)}` : count.format(value);
  type Line = {
    label: string;
    standard?: number;
    bonus?: number;
    currency?: Currency;
    cost?: boolean;
    strong?: boolean;
  };
  const lines: (Line | null)[] = [
    { label: t("earnings.credits"), standard: money.creditsBase, bonus: money.credits, currency: "credits" },
    costs > 0
      ? { label: t("earnings.costs"), standard: -costs, bonus: -costs, currency: "credits", cost: true }
      : null,
    {
      label: t("earnings.net"),
      standard: money.creditsBase === undefined ? undefined : money.creditsBase - costs,
      bonus: money.credits === undefined ? undefined : money.credits - costs,
      currency: "credits",
      strong: true,
    },
    { label: t("earnings.xp"), standard: money.xpBase, bonus: money.xp, currency: "xp" },
  ];
  const rows = lines.filter((row): row is Line => row !== null);

  const cell = (value: number | undefined, row: Line, highlight?: boolean) => (
    <dd
      className={cn(
        "inline-flex w-32 shrink-0 items-center justify-end gap-1 tabular-nums",
        row.strong && "font-semibold",
        // A net below zero reads as a cost, which is the point of the column.
        (row.cost || (value !== undefined && value < 0)) && "text-red-500",
        highlight && !row.cost && "text-foreground",
      )}
    >
      {signed(value)}
      {value !== undefined && row.currency ? (
        <span className="inline-flex w-5 justify-center">
          <CurrencyIcon type={row.currency} />
        </span>
      ) : null}
    </dd>
  );

  return (
    <div className="min-w-0">
      <div className="text-muted-foreground mb-1 flex items-baseline justify-between gap-3 text-xs font-medium uppercase tracking-wide">
        <h4>{t("earnings.title")}</h4>
        <span className="flex shrink-0 gap-3 normal-case tracking-normal">
          <span className="w-32 truncate pe-6 text-end whitespace-nowrap">{t("earnings.standard")}</span>
          <span className="w-32 truncate pe-6 text-end whitespace-nowrap">{t("earnings.with-bonuses")}</span>
        </span>
      </div>
      <dl className="text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-0.5">
            <dt className={cn("min-w-0 flex-1 truncate", row.strong && "font-medium")}>{row.label}</dt>
            <span className="text-muted-foreground flex shrink-0 gap-3">
              {cell(row.standard, row)}
              {cell(row.bonus, row, true)}
            </span>
          </div>
        ))}
      </dl>
    </div>
  );
}
