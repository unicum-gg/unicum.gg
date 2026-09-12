"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { CaretRightIcon } from "@phosphor-icons/react";
import Link from "@/components/link";
import { Fragment, useState } from "react";
import { toRoman } from "roman-numerals";
import type { PlayerSession, RatingMetric } from "@unicum.gg/shared";
import { NationFlag } from "@/components/tanks/nation-flag";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlossaryLabel } from "@/components/glossary/label";
import ROUTES from "@/constants/routes";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { DASH, visibleSessionColumns } from "./columns";

const DEC1_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

/**
 * One row per bucket of play, expandable into the vehicles that made it.
 *
 * The breakdown reuses the row's own columns, so a reader compares a bad day
 * with the tank that caused it by reading straight down. It is rendered only
 * once opened: a quarter of sessions carries a few hundred vehicle rows, and
 * nothing is gained by putting them all in the document up front.
 */
export function PlayerSessionsTable({
  region,
  sessions,
  metric,
  dateLabel,
}: {
  region: Region;
  sessions: PlayerSession[];
  metric: RatingMetric;
  /** How a bucket's date reads, which depends on its size. */
  dateLabel: (period: string) => string;
}) {
  const { locale } = useLocale();
  const { num } = useFormat();
  const { t } = useTranslation("components/players/detail/sessions/table");
  const { t: tCols } = useTranslation(
    "components/players/detail/sessions/columns",
  );
  const [open, setOpen] = useState<string | null>(null);
  const columns = visibleSessionColumns(sessions);

  return (
    <TooltipProvider delayDuration={150}>
      {/* The same cell rhythm as the tank list beside it: no vertical margin
          from the prose styles, tighter rows, and the first and last columns
          padded off the panel edge. */}
      {/* `rail`: even down to five columns the row is wider than a phone, and a
          hidden scrollbar says nothing about what is past the right edge. */}
      <Table
        rail
        className="my-0! [&_td]:py-1.5! [&_th]:py-2! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-[1%] whitespace-nowrap">{t("date")}</TableHead>
            <TableHead className="text-end">
              <GlossaryLabel>{t("battles")}</GlossaryLabel>
            </TableHead>
            <TableHead className={cn("text-end whitespace-nowrap", styles.hiddenColumn)}>
              <GlossaryLabel>{t("avg-tier")}</GlossaryLabel>
            </TableHead>
            <TableHead className={cn("text-end", styles.hiddenColumn)}>{t("tanks")}</TableHead>
            {columns.map((c) => {
              // The rating column's heading follows the reader's metric, so it
              // is looked up on what it currently says ("WN8"), never on the
              // column's own generic name.
              const heading = c.header ? c.header(metric) : c.label;
              return (
                <TableHead
                  key={c.key}
                  className={cn(
                    "text-end whitespace-nowrap",
                    c.hideOnMobile && styles.hiddenColumn,
                  )}
                >
                  {/* Two different strings: `label` is the ANCHOR the glossary
                      matches on and stays English by construction, while the
                      children are what the reader sees. The rating column is
                      the exception, since its heading is the metric's own name
                      ("WN8"), which is a name in every language. */}
                  <GlossaryLabel
                    label={heading}
                    tip={c.tip ? tCols(`${c.key}.tip`) : undefined}
                  >
                    {c.header ? heading : tCols(`${c.key}.label`)}
                  </GlossaryLabel>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => {
            const expanded = open === s.period;
            return (
              <Fragment key={s.period}>
                <TableRow
                  onClick={() => setOpen(expanded ? null : s.period)}
                  className="cursor-pointer"
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    <span className="inline-flex items-center gap-1">
                      <CaretRightIcon
                        className={cn(
                          "size-3 shrink-0 text-fd-muted-foreground transition-transform",
                          expanded && "rotate-90",
                        )}
                        weight="bold"
                      />
                      {dateLabel(s.period)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    {numberFormat(locale, INT_FORMAT).format(s.battles)}
                  </TableCell>
                  <TableCell className={cn("text-end", styles.hiddenColumn)}>
                    {s.avgTier == null ? DASH : num(DEC1_FORMAT).format(s.avgTier)}
                  </TableCell>
                  <TableCell className={cn("text-end", styles.hiddenColumn)}>
                    {s.tanks}
                  </TableCell>
                  {columns.map((c) => {
                    const cell = c.cell(s, metric, locale);
                    return (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "text-end",
                          c.hideOnMobile && styles.hiddenColumn,
                          cell.className,
                        )}
                      >
                        {cell.node}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {expanded &&
                  s.vehicles.map((v) => (
                    <TableRow
                      key={`${s.period}:${v.tankId}`}
                      className="bg-fd-muted/30"
                    >
                      <TableCell className="whitespace-nowrap ps-8">
                        <span className="inline-flex items-center gap-1.5">
                          {v.nation ? (
                            <NationFlag nation={v.nation} region={region} />
                          ) : null}
                          {v.type ? <VehicleTypeIcon type={v.type} /> : null}
                          <span className="text-fd-muted-foreground">
                            {v.tier ? toRoman(v.tier) : ""}
                          </span>
                          {v.slug ? (
                            <Link
                              href={ROUTES.TANK(region, v.slug)}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {v.shortName || v.name}
                            </Link>
                          ) : (
                            (v.shortName || v.name)
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-end">
                        {numberFormat(locale, INT_FORMAT).format(v.battles)}
                      </TableCell>
                      {/* The two the breakdown has nothing to put in (a vehicle
                          is one tier and one tank), hidden with the columns
                          they belong to so the row keeps its shape. */}
                      <TableCell className={styles.hiddenColumn} />
                      <TableCell className={styles.hiddenColumn} />
                      {columns.map((c) => {
                        const cell = c.cell(v, metric, locale);
                        return (
                          <TableCell
                            key={c.key}
                            className={cn(
                              "text-end",
                              c.hideOnMobile && styles.hiddenColumn,
                              cell.className,
                            )}
                          >
                            {cell.node}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
