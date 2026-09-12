import { numberFormat } from "@/lib/format";
import type { ReactNode } from "react";
import type { TranslateFunction } from "@onruntime/translations";
import {
  CREDITS_PER_GOLD,
  freeXpFromTier,
  goldToMoney,
  moneyFmt,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TankListItem } from "@/components/tanks/list";
import { useColumnVisibility } from "@/components/tanks/list/column-visibility";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DASH: ReactNode = <span className="text-fd-muted-foreground">—</span>;

export type EconColumn = {
  key: string;
  label: string;
  tip?: string;
  render: (t: TankListItem) => ReactNode;
  sortValue: (t: TankListItem) => number | null;
};

// Colored currency chips.
const credits = (v: number | null, locale: string): ReactNode =>
  v != null ? (
    <span className="text-[#E8B96A]">{numberFormat(locale, INT_FORMAT).format(v)}</span>
  ) : (
    DASH
  );
const gold = (v: number | null, locale: string): ReactNode =>
  v != null ? <span className="text-[#F2D45C]">{numberFormat(locale, INT_FORMAT).format(v)}</span> : DASH;

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
  t: TranslateFunction, locale: string,
): EconColumn[] {
  const fmt = moneyFmt(region);
  const cur = fmt?.resolvedOptions().currency ?? "";
  const base: EconColumn[] = [
    {
      key: "buyCredits",
      label: t("columns.buyCredits.label"),
      tip: t("columns.buyCredits.tip"),
      render: (t) => credits(t.specs?.buyCredits ?? null, locale),
      sortValue: (t) => t.specs?.buyCredits ?? null,
    },
    {
      key: "buyGold",
      label: t("columns.buyGold.label"),
      tip: t("columns.buyGold.tip"),
      // Reward tanks carry a restore-price placeholder in `buyGold`, not a real
      // store price, and aren't purchasable — show a dash rather than mislead.
      render: (t) => gold(t.isReward ? null : (t.specs?.buyGold ?? null), locale),
      sortValue: (t) => (t.isReward ? null : (t.specs?.buyGold ?? null)),
    },
    {
      key: "researchXp",
      label: t("columns.researchXp.label"),
      tip: t("columns.researchXp.tip"),
      render: (t) =>
        t.specs?.researchXp != null ? numberFormat(locale, INT_FORMAT).format(t.specs.researchXp) : DASH,
      sortValue: (t) => t.specs?.researchXp ?? null,
    },
    {
      key: "totalFreeXp",
      label: t("columns.totalFreeXp.label", { tier }),
      tip: t("columns.totalFreeXp.tip", { tier }),
      render: (t) => {
        const xp = freeXp(t, tier);
        return xp != null ? numberFormat(locale, INT_FORMAT).format(xp) : DASH;
      },
      sortValue: (t) => freeXp(t, tier),
    },
    {
      key: "shellCost",
      label: t("columns.shellCost.label"),
      tip: t("columns.shellCost.tip"),
      render: (t) => credits(t.specs?.shellCost ?? null, locale),
      sortValue: (t) => t.specs?.shellCost ?? null,
    },
    {
      key: "ammoCost",
      label: t("columns.ammoCost.label"),
      tip: t("columns.ammoCost.tip"),
      render: (t) => credits(t.specs?.ammoCost ?? null, locale),
      sortValue: (t) => t.specs?.ammoCost ?? null,
    },
  ];
  if (!fmt) return base;
  const money: EconColumn[] = [
    {
      key: "acquireMoney",
      label: t("columns.acquireMoney.label", { currency: cur }),
      tip: t("columns.acquireMoney.tip", { currency: cur }),
      render: (t) => moneyChip(fmt, acquireMoney(t, region, rate)),
      sortValue: (t) => acquireMoney(t, region, rate),
    },
    {
      key: "freeXpMoney",
      label: t("columns.freeXpMoney.label", { currency: cur }),
      tip: t("columns.freeXpMoney.tip", { currency: cur, tier }),
      render: (t) => moneyChip(fmt, freeXpMoney(t, region, tier, rate)),
      sortValue: (t) => freeXpMoney(t, region, tier, rate),
    },
  ];
  return [...base, ...money];
}

// Selectable columns. Keys must match `buildEconColumns`; the wording is the
// currency-free one under `selector` in `components/tanks/list/economics/columns`
// (the table headers add the region currency themselves).
export const ECON_COLUMN_META = [
  { key: "buyCredits" },
  { key: "buyGold" },
  { key: "researchXp" },
  { key: "totalFreeXp" },
  { key: "shellCost" },
  { key: "ammoCost" },
  { key: "acquireMoney" },
  { key: "freeXpMoney" },
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
