"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { calendarTitle, isCalendarMoment } from "@unicum.gg/shared";
import { useMemo, useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import type { DisplayZone } from "@/components/servers/format";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { entryAccent, type CalendarEntry } from "./entry-card";
import { dayKey, formatMonth, formatWeekday } from "./format";

type Month = { year: number; month: number };

/** A wall-clock date in the zone the grid is drawn in. */
function zonedDate(year: number, month: number, day: number, zone: DisplayZone): Date {
  return zone === "UTC"
    ? new Date(Date.UTC(year, month, day))
    : new Date(year, month, day);
}

function monthOf(at: Date, zone: DisplayZone): Month {
  return zone === "UTC"
    ? { year: at.getUTCFullYear(), month: at.getUTCMonth() }
    : { year: at.getFullYear(), month: at.getMonth() };
}

/** Six Monday-first weeks covering the month, as day keys and day numbers. */
function gridDays(
  { year, month }: Month,
  zone: DisplayZone,
): { key: string; day: number; inMonth: boolean; date: Date }[] {
  const first = zonedDate(year, month, 1, zone);
  const weekday = (zone === "UTC" ? first.getUTCDay() : first.getDay()) || 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = zonedDate(year, month, 2 - weekday + i, zone);
    const inMonth = (zone === "UTC" ? date.getUTCMonth() : date.getMonth()) === month;
    const day = zone === "UTC" ? date.getUTCDate() : date.getDate();
    return { key: dayKey(date, zone), day, inMonth, date };
  });
}

/** The day keys an entry covers: its start alone for a moment, every day it
 * spans otherwise (the end is exclusive, so a 10:00 end is not a day of its own
 * unless it falls after midnight). */
function coversDay(entry: CalendarEntry, key: string, zone: DisplayZone): boolean {
  // An all-day entry is a calendar date, so it is read in UTC whatever zone
  // the grid is in, or a reader west of Greenwich would see it a day early.
  if (entry.allDay) {
    return (
      key >= dayKey(entry.start, "UTC") &&
      key <= dayKey(new Date(entry.end.getTime() - 1), "UTC")
    );
  }
  const first = dayKey(entry.start, zone);
  if (isCalendarMoment(entry.start, entry.end)) return key === first;
  const last = dayKey(new Date(entry.end.getTime() - 1), zone);
  return key >= first && key <= last;
}

export function CalendarMonth({
  entries,
  now,
  recordedSince,
}: {
  entries: CalendarEntry[];
  now: Date;
  recordedSince: Date | null;
}) {
  const { t } = useTranslation("components/calendar/month");
  const { locale } = useFormat();
  const zone = useDisplayZone();
  const [shown, setShown] = useState<Month | null>(null);
  const month = shown ?? monthOf(now, zone);
  const days = useMemo(() => gridDays(month, zone), [month, zone]);
  const today = dayKey(now, zone);
  const step = (delta: number) =>
    setShown(monthOf(zonedDate(month.year, month.month + delta, 1, zone), zone));
  const earliest = recordedSince ? monthOf(recordedSince, zone) : null;
  const atEarliest =
    earliest !== null &&
    month.year * 12 + month.month <= earliest.year * 12 + earliest.month;

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-3">
        <PanelTitle className="capitalize">
          {formatMonth(zonedDate(month.year, month.month, 1, zone), zone, locale)}
        </PanelTitle>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} disabled={atEarliest} aria-label={t("previous")}>
            <CaretLeftIcon className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShown(null)}>
            {t("today")}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label={t("next")}>
            <CaretRightIcon className="size-4" />
          </Button>
        </div>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="grid grid-cols-7 border-b border-fd-border text-center text-xs uppercase text-fd-muted-foreground">
          {days.slice(0, 7).map(({ key, date }) => (
            <div key={key} className="py-2">
              {formatWeekday(date, zone, locale)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(({ key, day, inMonth }) => {
            const onDay = entries.filter((entry) => coversDay(entry, key, zone));
            return (
              <div
                key={key}
                className={cn(
                  "min-h-24 border-b border-r border-fd-border p-1 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-fd-secondary/20 text-fd-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                    key === today && "bg-brand font-semibold text-white",
                  )}
                >
                  {day}
                </div>
                <div className="flex flex-col gap-0.5">
                  {onDay.map((entry) => {
                    const title = calendarTitle(entry.titles, locale, entry.title);
                    const inner = (
                      <>
                        <span className={cn("size-1.5 shrink-0 rounded-full", entryAccent(entry.color))} />
                        <span className="truncate">{title}</span>
                      </>
                    );
                    const className =
                      "flex items-center gap-1 truncate rounded bg-fd-secondary/50 px-1 py-0.5 text-[0.6875rem] leading-tight";
                    return entry.link ? (
                      <a
                        key={entry.id}
                        href={entry.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={title}
                        className={cn(className, "hover:bg-fd-secondary")}
                      >
                        {inner}
                      </a>
                    ) : (
                      <span key={entry.id} title={title} className={className}>
                        {inner}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {atEarliest && recordedSince ? (
          <p className="px-4 py-3 text-xs text-fd-muted-foreground">{t("recorded-since")}</p>
        ) : null}
      </PanelContent>
    </Panel>
  );
}
