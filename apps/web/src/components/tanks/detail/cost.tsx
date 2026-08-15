"use client";

import type { TankSpec } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { CurrencyIcon, type Currency } from "@/components/tanks/currency-icon";
import {
  FreeXpTierSelect,
  XpRateInput,
} from "@/components/tanks/free-xp-controls";
import { useFreeXpSettings } from "@/hooks/use-free-xp";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CREDITS_PER_GOLD,
  freeXpFromTier,
  goldToMoney,
  moneyFmt,
} from "@unicum.gg/shared";

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
// WoT value is priced by converting it to gold (XP or 400 credits per gold) and
// running that through the region's store-bundle estimate. The XP-to-gold rate
// and the free-XP starting tier are user-set (shared with the economics table);
// premium tanks are priced in gold directly. The money estimate only shows for
// regions we have a bundle table for (EU today). Renders nothing when we have no
// economics for the tank.
export function TankCost({
  specs,
  region,
  isReward,
}: {
  specs: TankSpec;
  region: Region;
  isReward: boolean;
}) {
  const { tier, setTier, rate, rateInput, setRate } = useFreeXpSettings();
  const fmt = moneyFmt(region);
  const price = (gold: number) => goldToMoney(region, gold)?.amount ?? null;
  const money = (n: number | null) =>
    n != null && fmt ? `~${fmt.format(n)}` : "";
  const rows: CostRow[] = [];

  if (specs.researchXp && specs.researchXp > 0) {
    const gold = specs.researchXp / rate;
    rows.push({
      label: "XP cost",
      unit: "XP",
      value: specs.researchXp,
      gold,
      money: price(gold),
      icon: "xp",
      rate: `${intFmt.format(rate)} XP = 1 gold`,
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
  // Reward tanks aren't store-purchasable; their `buyGold` is a restore-price
  // placeholder, so showing it as a cost would mislead (see the economics table).
  if (!isReward && specs.buyGold && specs.buyGold > 0) {
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

  // Free XP priced from the chosen tier: `totalFreeXp` is the from-tier-1
  // cumulative; the tank's own tier is one above its highest ancestor, so the
  // picker is capped there and the global tier clamps to this tank's range.
  const byTier = specs.freeXpByTier as Record<string, number> | null;
  const maxTier = byTier
    ? Math.max(...Object.keys(byTier).map(Number))
    : 1;
  const effectiveTier = Math.min(tier, maxTier);
  const freeXp = freeXpFromTier(specs.totalFreeXp, byTier, effectiveTier);
  const freeXpGold = freeXp != null && freeXp > 0 ? freeXp / rate : freeXp;
  const freeXpMoney =
    freeXpGold != null && freeXpGold > 0 ? price(freeXpGold) : null;

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
        {freeXp != null && (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span className="flex items-center gap-1 text-sm opacity-80">
              Free XP
              <FreeXpTierSelect
                value={effectiveTier}
                onChange={setTier}
                maxTier={maxTier}
                triggerClassName="h-5! gap-0.5 px-1! border-white/25 bg-transparent text-white hover:bg-white/10 dark:bg-transparent dark:hover:bg-white/10"
              />
            </span>
            <span className="mx-1 mb-1 flex-1 self-end border-b border-dotted border-white/40" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1.5 text-sm font-bold tabular-nums">
                  {intFmt.format(freeXp)}
                  {money(freeXpMoney) && (
                    <span className="text-white/60">({money(freeXpMoney)})</span>
                  )}
                  <CurrencyIcon type="xp" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p>
                    {intFmt.format(freeXp)} XP ={" "}
                    {intFmt.format(Math.round((freeXpGold ?? 0)))} gold
                    {money(freeXpMoney) ? ` = ${money(freeXpMoney)}` : ""}
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    Cumulative XP to research from tier {effectiveTier},
                    prerequisite modules included · {intFmt.format(rate)} XP = 1
                    gold
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {rows.some((r) => r.unit === "XP") || freeXp != null ? (
          <div className="mt-1 flex items-center gap-1 border-t border-white/10 pt-1.5 text-xs text-white/50">
            <span>Rate</span>
            <span className="mx-1 mb-1 flex-1 self-end border-b border-dotted border-white/25" />
            <span className="flex items-center gap-1.5 whitespace-nowrap text-white/70">
              <XpRateInput
                value={rateInput}
                onChange={setRate}
                className="h-5! border-white/25 text-white hover:border-white/40"
              />
              XP = 1 gold
            </span>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
