"use client";

import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import Link from "@/components/link";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { CurrencyIcon, type Currency } from "@/components/tanks/currency-icon";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  SortDirection,
  SortableHead,
  type SortState,
} from "@/components/tanks/sortable-head";
import { FilterSubject } from "@/components/filter-subject";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { type RangeColumn, useTankFilters } from "@/hooks/use-tank-filters";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import {
  RebuildCurrency,
  moneyFmt,
  vehicleRebuildCost,
  type PlayerTankRow,
  type VehicleRebuildCost,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

/** A vehicle beside what the store would charge for it, flattened onto the row
 * so the filter hook and the sort read one object. */
type CostRow = PlayerTankRow & { cost: VehicleRebuildCost };

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

function sortValue(r: CostRow, key: string): number | string {
  switch (key) {
    case "nation":
      return r.nation ?? "";
    case "type":
      return TYPE_ABBR[r.type ?? ""] ?? r.type ?? "";
    case "tier":
      return r.tier ?? 0;
    case "name":
      return r.name.toLowerCase();
    case "research":
      return r.cost.research;
    case "purchase":
      return r.cost.purchase;
    default:
      return r.cost.total;
  }
}

/** What a row pays in one currency: the amount in the game's own money, its
 * glyph, and what the store charges for it. */
function Amount({
  units,
  currency,
  money,
  fmt,
}: {
  units: number;
  currency: Currency;
  money: string;
  fmt: Intl.NumberFormat;
}) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="text-xs text-fd-muted-foreground">
        {fmt.format(units)}
      </span>
      <CurrencyIcon type={currency} />
      <span>{money}</span>
    </span>
  );
}

/**
 * Every vehicle the rebuild cost is made of, at the price the store puts on it.
 *
 * The prices are not recomputed here: each row is `vehicleRebuildCost`, the
 * same function the total above sums, so a row and the headline figure cannot
 * drift apart. Reward tanks are absent because the shop never prices them,
 * which the note above the table says, along with the other two reasons a
 * vehicle in the garage can be missing from this list.
 *
 * Everything that is not a price is the site's own vehicle table: the same four
 * leading columns, the same sortable headings, and the same filter bar the
 * catalogue and the profile's own tank list use, so a reader who has filtered
 * one has filtered them all.
 */
export function TankCostsTable({
  region,
  nickname,
  vehicles,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
}) {
  const { num, locale } = useFormat();
  const { t } = useTranslation("components/players/detail/value/tank-costs");
  const { t: tTable } = useTranslation("components/tanks/table");
  const { t: tTanks } = useTranslation(
    "components/players/detail/tanks/table",
  );
  const fmt = moneyFmt(region, locale);
  const money = (n: number) => (fmt ? fmt.format(n) : `~${n.toFixed(0)}`);
  const unitFmt = num({ maximumFractionDigits: 0 });
  const [sort, setSort] = useState<SortState>({
    key: "total",
    direction: SortDirection.Desc,
  });

  // Memoized: `usePagination` resets its page when the array identity changes,
  // and does it DURING render, so a list rebuilt every pass would loop.
  // `gunMarks`/`masteryBadge` are mapped for the filter hook exactly as the
  // profile's tank table maps them, since the catalogue already uses
  // `moe`/`mom` for the region's thresholds.
  const rows = useMemo(() => {
    const out: (CostRow & { gunMarks: number | null; masteryBadge: number | null })[] = [];
    for (const tank of vehicles) {
      const cost = vehicleRebuildCost(tank, region);
      if (cost) {
        out.push({ ...tank, cost, gunMarks: tank.moe, masteryBadge: tank.mom });
      }
    }
    return out;
  }, [vehicles, region]);

  // The three money columns the min/max range filter can target, the way each
  // vehicle list ranges over its own.
  const rangeCols: RangeColumn<CostRow>[] = useMemo(
    () => [
      { key: "total", label: t("total"), value: (r) => r.cost.total },
      { key: "research", label: t("research"), value: (r) => r.cost.research },
      { key: "purchase", label: t("purchase"), value: (r) => r.cost.purchase },
    ],
    [t],
  );
  const { filtered, filters } = useTankFilters(rows, rangeCols, "total");

  // What the garage holds that this list cannot: a reader counting the rows
  // against their own garage comes up short, and the note at the foot of the
  // page is too far from the table to answer them. Both figures are derived
  // rather than stored, since the rows the cost function priced at nothing are
  // exactly the ones missing here.
  const unlisted = useMemo(() => {
    let reward = 0;
    let free = 0;
    for (const v of vehicles) {
      if (v.isReward) reward += 1;
      else if (!v.isPremium && !v.researchXp && !v.buyCredits) free += 1;
    }
    return { reward, free };
  }, [vehicles]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const mul = sort.direction === SortDirection.Asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "string" && typeof bv === "string") {
        return mul * av.localeCompare(bv);
      }
      return mul * ((av as number) - (bv as number));
    });
  }, [filtered, sort]);

  const { paged, pager } = usePagination(sorted);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: SortDirection.Desc };
      if (prev.direction === SortDirection.Desc)
        return { key, direction: SortDirection.Asc };
      return null;
    });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2.5 p-4">
        <p className="text-xs text-fd-muted-foreground">
          {t("only-vehicles-this-account-has")}{" "}
          {unlisted.reward > 0
            ? t("n-reward-tanks-are-not", {
                count: unitFmt.format(unlisted.reward),
              })
            : null}{" "}
          {unlisted.free > 0
            ? t("n-tier-i-vehicles-are", { count: unitFmt.format(unlisted.free) })
            : null}
        </p>
        <TankFilterBar filters={filters} searchNoun={FilterSubject.Tanks} />
      </div>
      <div className="border-t border-fd-border">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {tTanks("no-tanks-match-these-filters")}</p>
        ) : (
          <>
            {/* `rail` and the padding overrides mirror the profile's vehicle
                table: same columns, so the same measurements. */}
            <Table
              rail
              className="my-0! [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!"
            >
              <TableHeader>
                <TableRow>
                  <SortableHead
                    col="nation"
                    state={sort}
                    onToggle={toggleSort}
                    align="center"
                    hideOnMobile
                    headClassName="w-px"
                    tooltip={tTable("nation")}
                  >
                    <TankopediaHeaderIcon name="nation" />
                  </SortableHead>
                  <SortableHead
                    col="type"
                    state={sort}
                    onToggle={toggleSort}
                    align="center"
                    hideOnMobile
                    headClassName="w-px"
                    tooltip={tTable("type")}
                  >
                    <TankopediaHeaderIcon name="type" />
                  </SortableHead>
                  <SortableHead
                    col="tier"
                    state={sort}
                    onToggle={toggleSort}
                    align="center"
                    hideOnMobile
                    headClassName="w-px"
                    tooltip={tTable("tier")}
                  >
                    <span className="whitespace-nowrap text-xs font-medium tracking-tight text-fd-muted-foreground">
                      I-XI
                    </span>
                  </SortableHead>
                  <SortableHead col="name" state={sort} onToggle={toggleSort}>
                    {tTable("name")}</SortableHead>
                  <SortableHead
                    col="research"
                    state={sort}
                    onToggle={toggleSort}
                    align="end"
                  >
                    {t("research")}</SortableHead>
                  <SortableHead
                    col="purchase"
                    state={sort}
                    onToggle={toggleSort}
                    align="end"
                  >
                    {t("purchase")}</SortableHead>
                  <SortableHead
                    col="total"
                    state={sort}
                    onToggle={toggleSort}
                    align="end"
                  >
                    {t("total")}</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => {
                  const name = r.shortName || r.name || `#${r.tankId}`;
                  const premium = r.cost.purchaseCurrency === RebuildCurrency.Gold;
                  return (
                    <TableRow key={r.tankId}>
                      <TableCell className={cn("text-center", styles.hiddenColumn)}>
                        {r.nation ? (
                          <NationFlag nation={r.nation} region={region} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-center", styles.hiddenColumn)}>
                        {r.type ? (
                          <VehicleTypeIcon type={r.type} premium={premium} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-center font-medium",
                          styles.hiddenColumn,
                          premium && "text-[#FAB81B]",
                        )}
                      >
                        {r.tier ? toRoman(r.tier) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium whitespace-nowrap max-sm:pl-4!",
                          premium && "text-[#FAB81B]",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {r.tag && r.type ? (
                            <TankIcon
                              region={region}
                              tag={r.tag}
                              type={r.type}
                              className="h-3.5 w-auto shrink-0 object-contain"
                            />
                          ) : null}
                          {r.slug ? (
                            <Link
                              href={ROUTES.PLAYER_TANK(region, nickname, r.slug)}
                              scroll={false}
                              className="hover:underline"
                            >
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </span>
                      </TableCell>
                      {/* The currency the player would actually hand over, not
                          the gold it converts to: a tech-tree tank is bought
                          with credits, and showing its gold equivalent under a
                          gold coin reads as a price the store never asks. */}
                      <TableCell className="text-right tabular-nums">
                        {r.cost.research ? (
                          <Amount
                            units={r.researchXp ?? 0}
                            currency="xp"
                            money={money(r.cost.research)}
                            fmt={unitFmt}
                          />
                        ) : (
                          <span className="text-fd-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Amount
                          units={(premium ? r.buyGold : r.buyCredits) ?? 0}
                          currency={premium ? "gold" : "credits"}
                          money={money(r.cost.purchase)}
                          fmt={unitFmt}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money(r.cost.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePager pager={pager} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
