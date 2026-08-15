import type { ReactNode } from "react";
import {
  CREDITS_PER_GOLD,
  freeXpFromTier,
  goldToMoney,
  moneyFmt,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TankListItem } from "@/components/tanks/list";
import { useColumnVisibility } from "@/components/tanks/list/column-visibility";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

export type EconColumn = {
  key: string;
  label: string;
  tip?: string;
  render: (t: TankListItem) => ReactNode;
  sortValue: (t: TankListItem) => number | null;
};

// Colored currency chips.
const credits = (v: number | null): ReactNode =>
  v != null ? (
    <span className="text-[#E8B96A]">{intFmt.format(v)}</span>
  ) : (
    DASH
  );
const gold = (v: number | null): ReactNode =>
  v != null ? <span className="text-[#F2D45C]">{intFmt.format(v)}</span> : DASH;

// Real-money value of a gold amount in the region's store currency (green like
// the tank page's cost panel). Null renders a dash.
function moneyChip(
  fmt: Intl.NumberFormat | null,
  amount: number | null,
): ReactNode {
  return amount != null && fmt ? (
    <span className="text-emerald-400/90">~{fmt.format(amount)}</span>
  ) : (
    DASH
  );
}

// Free XP to research this tank from the chosen starting tier (modules
// included). Tier 1 = the full cheapest-path total; a higher tier subtracts the
// XP you'd already have sunk into the ancestors you own.
function freeXp(t: TankListItem, tier: number): number | null {
  return freeXpFromTier(t.specs?.totalFreeXp, t.specs?.freeXpByTier, tier);
}

// Real money to free-XP this tank's line, at the chosen rate. Region currency.
function freeXpMoney(
  t: TankListItem,
  region: Region,
  tier: number,
  rate: number,
): number | null {
  const xp = freeXp(t, tier);
  return xp != null && xp > 0
    ? (goldToMoney(region, xp / rate)?.amount ?? null)
    : xp === 0
      ? 0
      : null;
}

// Real money to acquire this tank the normal way: research XP + credits price
// converted to gold and priced (or the gold price directly for premiums). Each
// component is priced then summed, matching the tank page's Total cost (the
// bundle estimate is non-linear, so summing golds first would misprice).
function acquireMoney(
  t: TankListItem,
  region: Region,
  rate: number,
): number | null {
  const s = t.specs;
  if (!s) return null;
  // Reward tanks aren't store-purchasable (their `buyGold` in WG's data is a
  // restore placeholder, not a price), so a "buy cost" is meaningless for them.
  if (t.isReward) return null;
  const parts: number[] = [];
  if (s.buyGold) {
    const m = goldToMoney(region, s.buyGold)?.amount;
    if (m != null) parts.push(m);
  }
  if (s.researchXp) {
    const m = goldToMoney(region, s.researchXp / rate)?.amount;
    if (m != null) parts.push(m);
  }
  if (s.buyCredits) {
    const m = goldToMoney(region, s.buyCredits / CREDITS_PER_GOLD)?.amount;
    if (m != null) parts.push(m);
  }
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

export function buildEconColumns(
  region: Region,
  tier: number,
  rate: number,
): EconColumn[] {
  const fmt = moneyFmt(region);
  const cur = fmt?.resolvedOptions().currency ?? "";
  const base: EconColumn[] = [
    {
      key: "buyCredits",
      label: "Cost (credits)",
      tip: "Purchase price in credits (tech-tree tanks)",
      render: (t) => credits(t.specs?.buyCredits ?? null),
      sortValue: (t) => t.specs?.buyCredits ?? null,
    },
    {
      key: "buyGold",
      label: "Cost (gold)",
      tip: "Purchase price in gold (premium tanks)",
      // Reward tanks carry a restore-price placeholder in `buyGold`, not a real
      // store price, and aren't purchasable — show a dash rather than mislead.
      render: (t) => gold(t.isReward ? null : (t.specs?.buyGold ?? null)),
      sortValue: (t) => (t.isReward ? null : (t.specs?.buyGold ?? null)),
    },
    {
      key: "researchXp",
      label: "Research XP",
      tip: "XP to unlock (cheapest path)",
      render: (t) =>
        t.specs?.researchXp != null ? intFmt.format(t.specs.researchXp) : DASH,
      sortValue: (t) => t.specs?.researchXp ?? null,
    },
    {
      key: "totalFreeXp",
      label: `Free XP (T${tier})`,
      tip: `Cumulative XP to research from tier ${tier}, prerequisite modules included`,
      render: (t) => {
        const xp = freeXp(t, tier);
        return xp != null ? intFmt.format(xp) : DASH;
      },
      sortValue: (t) => freeXp(t, tier),
    },
    {
      key: "shellCost",
      label: "Shell cost",
      tip: "Default shell price (credits)",
      render: (t) => credits(t.specs?.shellCost ?? null),
      sortValue: (t) => t.specs?.shellCost ?? null,
    },
    {
      key: "ammoCost",
      label: "Full ammo cost",
      tip: "Default shell price × ammo capacity",
      render: (t) => credits(t.specs?.ammoCost ?? null),
      sortValue: (t) => t.specs?.ammoCost ?? null,
    },
  ];
  if (!fmt) return base;
  const money: EconColumn[] = [
    {
      key: "acquireMoney",
      label: `Buy cost (${cur})`,
      tip: `Estimated real money to acquire the tank (research + purchase), in ${cur}`,
      render: (t) => moneyChip(fmt, acquireMoney(t, region, rate)),
      sortValue: (t) => acquireMoney(t, region, rate),
    },
    {
      key: "freeXpMoney",
      label: `Free XP (${cur})`,
      tip: `Estimated real money to free-XP the tank from tier ${tier}, in ${cur}`,
      render: (t) => moneyChip(fmt, freeXpMoney(t, region, tier, rate)),
      sortValue: (t) => freeXpMoney(t, region, tier, rate),
    },
  ];
  return [...base, ...money];
}

// Selectable columns (currency-free labels; the table headers add the region
// currency). Keys must match `buildEconColumns`. All visible by default.
export const ECON_COLUMN_META = [
  { key: "buyCredits", label: "Cost (credits)" },
  { key: "buyGold", label: "Cost (gold)" },
  { key: "researchXp", label: "Research XP" },
  { key: "totalFreeXp", label: "Free XP" },
  { key: "shellCost", label: "Shell cost" },
  { key: "ammoCost", label: "Full ammo cost" },
  { key: "acquireMoney", label: "Buy cost (money)" },
  { key: "freeXpMoney", label: "Free XP (money)" },
] as const;
const ECON_KEYS = ECON_COLUMN_META.map((c) => c.key);
const ECON_COOKIE = "unicum.econ_columns";
// Shell/ammo cost are niche, hidden by default to keep the table focused on
// acquisition cost; the selector brings them back.
const ECON_DEFAULT_KEYS = ECON_KEYS.filter(
  (k) => k !== "shellCost" && k !== "ammoCost",
);

export function useEconColumns() {
  return useColumnVisibility(ECON_COOKIE, ECON_KEYS, ECON_DEFAULT_KEYS);
}
