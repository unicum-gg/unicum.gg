"use client";

import type { TankSpec } from "@unicum.gg/core/db/schema";
import { CurrencyIcon, type Currency } from "@/components/tanks/currency-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CREDITS_PER_GOLD,
  XP_PER_GOLD,
  eurosFmt,
  goldToEuros,
} from "@/lib/gold-pricing";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const eur = (n: number) => `~${eurosFmt.format(n)}`;

type CostRow = {
  label: string;
  unit: "XP" | "credits" | "gold";
  value: number;
  gold: number;
  euros: number;
  icon: Currency;
  rate?: string;
};

// Estimated real-money cost of unlocking + buying a tank, à la gunmarks: each
// WoT value is priced by converting it to gold (25 XP or 400 credits per gold)
// and running that through the store-bundle euro estimate. Premium tanks are
// priced in gold directly. Renders nothing when we have no economics for the tank.
export function TankCost({ specs }: { specs: TankSpec }) {
  const rows: CostRow[] = [];

  if (specs.researchXp && specs.researchXp > 0) {
    const gold = specs.researchXp / XP_PER_GOLD;
    rows.push({
      label: "XP cost",
      unit: "XP",
      value: specs.researchXp,
      gold,
      euros: goldToEuros(gold),
      icon: "xp",
      rate: `${XP_PER_GOLD} XP = 1 gold`,
    });
  }
  if (specs.buyCredits && specs.buyCredits > 0) {
    const gold = specs.buyCredits / CREDITS_PER_GOLD;
    rows.push({
      label: "Credits cost",
      unit: "credits",
      value: specs.buyCredits,
      gold,
      euros: goldToEuros(gold),
      icon: "credits",
      rate: `${CREDITS_PER_GOLD} credits = 1 gold`,
    });
  }
  if (specs.buyGold && specs.buyGold > 0) {
    rows.push({
      label: "Cost",
      unit: "gold",
      value: specs.buyGold,
      gold: specs.buyGold,
      euros: goldToEuros(specs.buyGold),
      icon: "gold",
    });
  }

  if (rows.length === 0) return null;

  const totalEuros = rows.reduce((sum, r) => sum + r.euros, 0);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-72 max-w-[70vw] space-y-1 text-white">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-end justify-between gap-1 whitespace-nowrap"
          >
            <span className="text-sm opacity-80">{r.label}</span>
            <span className="mx-2 mb-1 flex-1 border-b border-dotted border-white/40" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1.5 text-sm font-bold tabular-nums">
                  {intFmt.format(r.value)}
                  <span className="text-white/60">({eur(r.euros)})</span>
                  <CurrencyIcon type={r.icon} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {r.unit === "gold"
                      ? `${intFmt.format(r.value)} gold = ${eurosFmt.format(r.euros)}`
                      : `${intFmt.format(r.value)} ${r.unit} = ${intFmt.format(r.gold)} gold = ${eurosFmt.format(r.euros)}`}
                  </p>
                  {r.rate && (
                    <p className="mt-1 text-xs opacity-70">{r.rate}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
        {rows.length > 1 && (
          <div className="flex items-end justify-between gap-1 whitespace-nowrap pt-0.5">
            <span className="text-sm font-semibold text-emerald-400">
              Total cost
            </span>
            <span className="mx-2 mb-1 flex-1 border-b border-dotted border-white/40" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm font-bold tabular-nums text-emerald-400">
                  {eur(totalEuros)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {rows.map((r) => eurosFmt.format(r.euros)).join(" + ")} ={" "}
                    {eurosFmt.format(totalEuros)}
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    Priced from the WoT gold bundles
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {specs.totalFreeXp != null && specs.totalFreeXp > 0 && (
          <div className="flex items-end justify-between gap-1 whitespace-nowrap">
            <span className="text-sm opacity-80">Free XP from T1</span>
            <span className="mx-2 mb-1 flex-1 border-b border-dotted border-white/40" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1.5 text-sm font-bold tabular-nums">
                  {intFmt.format(specs.totalFreeXp)}
                  <span className="text-white/60">
                    ({eur(goldToEuros(specs.totalFreeXp / XP_PER_GOLD))})
                  </span>
                  <CurrencyIcon type="xp" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {intFmt.format(specs.totalFreeXp)} XP ={" "}
                    {intFmt.format(specs.totalFreeXp / XP_PER_GOLD)} gold ={" "}
                    {eurosFmt.format(goldToEuros(specs.totalFreeXp / XP_PER_GOLD))}
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    Cumulative XP to research from tier 1 · 25 XP = 1 gold
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
