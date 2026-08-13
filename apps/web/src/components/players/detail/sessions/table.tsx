"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import {
  DASH,
  sessionIntFmt as intFmt,
  visibleSessionColumns,
} from "./columns";

const dec1Fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

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
  const [open, setOpen] = useState<string | null>(null);
  const columns = visibleSessionColumns(sessions);

  return (
    <TooltipProvider delayDuration={150}>
      {/* The same cell rhythm as the tank list beside it: no vertical margin
          from the prose styles, tighter rows, and the first and last columns
          padded off the panel edge. */}
      <Table className="my-0! [&_td]:py-1.5! [&_th]:py-2! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[1%] whitespace-nowrap">Date</TableHead>
            <TableHead className="text-end">Battles</TableHead>
            <TableHead className="text-end whitespace-nowrap">Avg tier</TableHead>
            <TableHead className="text-end">Tanks</TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-end whitespace-nowrap">
                {c.tip ? (
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      {c.header ? c.header(metric) : c.label}
                    </TooltipTrigger>
                    <TooltipContent>{c.tip}</TooltipContent>
                  </Tooltip>
                ) : c.header ? (
                  c.header(metric)
                ) : (
                  c.label
                )}
              </TableHead>
            ))}
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
                    {intFmt.format(s.battles)}
                  </TableCell>
                  <TableCell className="text-end">
                    {s.avgTier == null ? DASH : dec1Fmt.format(s.avgTier)}
                  </TableCell>
                  <TableCell className="text-end">{s.tanks}</TableCell>
                  {columns.map((c) => {
                    const cell = c.cell(s, metric);
                    return (
                      <TableCell
                        key={c.key}
                        className={cn("text-end", cell.className)}
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
                        {intFmt.format(v.battles)}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      {columns.map((c) => {
                        const cell = c.cell(v, metric);
                        return (
                          <TableCell
                            key={c.key}
                            className={cn("text-end", cell.className)}
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
