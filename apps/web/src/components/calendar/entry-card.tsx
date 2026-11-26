"use client";

import { ArrowSquareOutIcon, DiscordLogoIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { calendarKind, calendarTitle, isCalendarMoment } from "@unicum.gg/shared";
import type { z } from "zod";
import type { CalendarResponse } from "@/app/api/[region]/calendar/schema.api";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import { cn } from "@/lib/utils";
import { formatRelative, formatWhen } from "./format";

export type CalendarEntry = z.infer<typeof CalendarResponse>["entries"][number];

/** The widget's own colour tokens, as the accent each entry is drawn in. */
export const ENTRY_ACCENT: Record<string, string> = {
  green: "bg-emerald-500",
  azure: "bg-sky-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};
export const entryAccent = (color: string) => ENTRY_ACCENT[color] ?? "bg-fd-muted-foreground";

export const discordEventUrl = (eventId: string) =>
  `https://discord.com/events/1512415714982625420/${eventId}`;

/** The countdown line: when it starts, when it ends, or that it is over. */
function useStatus(entry: CalendarEntry, now: Date): string {
  const { t } = useTranslation("components/calendar/entry-card");
  const { locale } = useFormat();
  const start = entry.start.getTime() - now.getTime();
  const end = entry.end.getTime() - now.getTime();
  if (isCalendarMoment(entry.start, entry.end)) {
    return start > 0
      ? t("status.lands", { when: formatRelative(start, locale) })
      : t("status.landed", { when: formatRelative(start, locale) });
  }
  if (start > 0) return t("status.starts", { when: formatRelative(start, locale) });
  if (end > 0) return t("status.ends", { when: formatRelative(end, locale) });
  return t("status.ended", { when: formatRelative(end, locale) });
}

export function CalendarEntryCard({
  entry,
  now,
}: {
  entry: CalendarEntry;
  now: Date;
}) {
  const { t } = useTranslation("components/calendar/entry-card");
  const { locale } = useFormat();
  const zone = useDisplayZone();
  const status = useStatus(entry, now);
  const moment = isCalendarMoment(entry.start, entry.end);
  const live = !moment && entry.start <= now && entry.end > now;
  const over = entry.end <= now;
  const title = calendarTitle(entry.titles, locale, entry.title);
  const image = entry.banner ?? entry.thumbnail;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden border-fd-border bg-fd-card sm:flex-row",
        over && "opacity-70",
      )}
    >
      {image ? (
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-[1022/360] shrink-0 overflow-hidden bg-fd-secondary sm:w-72"
        >
          <Image src={image} alt="" fill sizes="(min-width: 640px) 18rem, 100vw" className="object-cover" />
        </a>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wide text-fd-muted-foreground">
            <span className={cn("size-2 rounded-full", entryAccent(entry.color))} />
            {t(`kind.${calendarKind(entry.icon)}`)}
          </span>
          {live ? (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-500">
              {t("live")}
            </span>
          ) : null}
          <span className="text-fd-muted-foreground">{status}</span>
        </div>
        <h3 className="font-heading text-lg font-semibold leading-snug">
          <a href={entry.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {title}
          </a>
        </h3>
        <p className="text-sm text-fd-muted-foreground">
          {moment
            ? formatWhen(entry.start, zone, locale)
            : `${formatWhen(entry.start, zone, locale)} → ${formatWhen(entry.end, zone, locale)}`}
          {zone === "UTC" ? " UTC" : null}
        </p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-fd-muted-foreground hover:text-fd-foreground"
          >
            <ArrowSquareOutIcon className="size-4" />
            {t("read-the-news")}
          </a>
          {entry.discordEventId && !over ? (
            <a
              href={discordEventUrl(entry.discordEventId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-fd-muted-foreground hover:text-fd-foreground"
            >
              <DiscordLogoIcon className="size-4 text-[#5865F2]" />
              {t("remind-me")}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
