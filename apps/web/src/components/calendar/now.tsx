"use client";

import { calendarKind, calendarTitle } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "@/components/link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { entryAccent, type CalendarEntry } from "./entry-card";
import { formatDay } from "./format";

/**
 * The calendar's entries of the moment, as a row of cards on the home page,
 * each leading to the calendar. Dates are days, read in UTC: the page is
 * prerendered, so a clock time would be the server's and a countdown would be
 * as old as the cache.
 */
export function CalendarNow({
  region,
  entries,
  renderedAt,
}: {
  region: Region;
  entries: CalendarEntry[];
  renderedAt: Date;
}) {
  const { t } = useTranslation("components/calendar/now");
  const { t: tKind } = useTranslation("components/calendar/entry-card");
  const { locale } = useFormat();
  if (entries.length === 0) return null;
  const href = ROUTES.CALENDAR(region);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
      </PanelHeader>
      <PanelContent className="px-4 py-4">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {entries.map((entry) => {
            const lastDay = new Date(entry.end.getTime() - 1);
            const when =
              entry.start > renderedAt
                ? t("from", { day: formatDay(entry.start, locale) })
                : t("until", { day: formatDay(lastDay, locale) });
            const image = entry.banner ?? entry.thumbnail;
            return (
              <li key={entry.id}>
                <Link
                  href={href}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-fd-border bg-fd-card transition-colors hover:bg-fd-secondary/40"
                >
                  <div className="relative aspect-[3/1] bg-fd-secondary">
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-fd-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", entryAccent(entry.color))} />
                      {tKind(`kind.${calendarKind(entry.icon)}`)}
                    </span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug">
                      {calendarTitle(entry.titles, locale, entry.title)}
                    </span>
                    <span className="mt-auto text-xs text-fd-muted-foreground">{when}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            {t("see-all")}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </PanelContent>
    </Panel>
  );
}
