"use client";

import type { TankSpec } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { CurrencyIcon, type Currency } from "@/components/tanks/currency-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CREDITS_PER_GOLD, XP_PER_GOLD } from "@/constants/shop";
import { goldToMoney, moneyFmt } from "@/lib/shop";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type CostRow = {
  label: string;
  unit: "XP" | "credits" | "gold";
  value: number;
  gold: number;
  money: number | null;
  icon: Currency;
  rate?: string;
};

// Estimated real-money cost of unlocking + buying a tank, à la gunmarks: each
// WoT value is priced by converting it to gold (25 XP or 400 credits per gold)
// and running that through the region's store-bundle estimate. Premium tanks are
// priced in gold directly. The money estimate only shows for regions we have a
// bundle table for (EU today); elsewhere the gold figures stand alone. Renders
// nothing when we have no economics for the tank.
export function TankCost({ specs, region }: { specs: TankSpec; region: Region }) {
  const fmt = moneyFmt(region);
  const price = (gold: number) => goldToMoney(region, gold)?.amount ?? null;
  const money = (n: number | null) =>
    n != null && fmt ? `~${fmt.format(n)}` : "";
  const rows: CostRow[] = [];

  if (specs.researchXp && specs.researchXp > 0) {
    const gold = specs.researchXp / XP_PER_GOLD;
    rows.push({
      label: "XP cost",
      unit: "XP",
      value: specs.researchXp,
      gold,
      money: price(gold),
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
      money: price(gold),
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
      money: price(specs.buyGold),
      icon: "gold",
    });
  }

  if (rows.length === 0) return null;

  const totalMoney =
    fmt && rows.every((r) => r.money != null)
      ? rows.reduce((sum, r) => sum + (r.money ?? 0), 0)
      : null;
  const freeXpGold =
    specs.totalFreeXp != null && specs.totalFreeXp > 0
      ? specs.totalFreeXp / XP_PER_GOLD
      : null;
  const freeXpMoney = freeXpGold != null ? price(freeXpGold) : null;

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
                  {money(r.money) && (
                    <span className="text-white/60">({money(r.money)})</span>
                  )}
                  <CurrencyIcon type={r.icon} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {r.unit === "gold"
                      ? `${intFmt.format(r.value)} gold${money(r.money) ? ` = ${money(r.money)}` : ""}`
                      : `${intFmt.format(r.value)} ${r.unit} = ${intFmt.format(r.gold)} gold${money(r.money) ? ` = ${money(r.money)}` : ""}`}
                  </p>
                  {r.rate && (
                    <p className="mt-1 text-xs opacity-70">{r.rate}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
        {rows.length > 1 && totalMoney != null && (
          <div className="flex items-end justify-between gap-1 whitespace-nowrap pt-0.5">
            <span className="text-sm font-semibold text-emerald-400">
              Total cost
            </span>
            <span className="mx-2 mb-1 flex-1 border-b border-dotted border-white/40" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm font-bold tabular-nums text-emerald-400">
                  {money(totalMoney)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {rows.map((r) => money(r.money)).join(" + ")} ={" "}
                    {money(totalMoney)}
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
                  {money(freeXpMoney) && (
                    <span className="text-white/60">({money(freeXpMoney)})</span>
                  )}
                  <CurrencyIcon type="xp" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {intFmt.format(specs.totalFreeXp)} XP ={" "}
                    {intFmt.format(specs.totalFreeXp / XP_PER_GOLD)} gold
                    {money(freeXpMoney) ? ` = ${money(freeXpMoney)}` : ""}
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    Cumulative XP to research from tier 1, prerequisite
                    modules included · 25 XP = 1 gold
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
