"use client";

import { isCalendarMoment } from "@unicum.gg/shared";
import { Fragment } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { useTranslation } from "@/hooks/use-translation";
import { CalendarEntryCard, type CalendarEntry } from "./entry-card";

/** How far back the list reads. The month view reaches the rest. */
const PAST_DAYS = 45;

export type CalendarSections = {
  live: CalendarEntry[];
  upcoming: CalendarEntry[];
  past: CalendarEntry[];
};

/**
 * The entries as a reader asks about them: what is on now, what is coming, and
 * what just finished. An update is a moment rather than a span, so it is never
 * "on now": it is coming until it lands and past from then.
 */
export function splitCalendar(entries: CalendarEntry[], now: Date): CalendarSections {
  const since = now.getTime() - PAST_DAYS * 86_400_000;
  const sections: CalendarSections = { live: [], upcoming: [], past: [] };
  for (const entry of entries) {
    if (entry.start > now) sections.upcoming.push(entry);
    else if (entry.end > now && !isCalendarMoment(entry.start, entry.end)) sections.live.push(entry);
    else if (entry.end.getTime() >= since) sections.past.push(entry);
  }
  // Live by what ends first, so the most urgent is on top; the past newest first.
  sections.live.sort((a, b) => a.end.getTime() - b.end.getTime());
  sections.past.sort((a, b) => b.end.getTime() - a.end.getTime());
  return sections;
}

function Section({
  title,
  entries,
  now,
  empty,
}: {
  title: string;
  entries: CalendarEntry[];
  now: Date;
  empty?: string;
}) {
  if (entries.length === 0 && !empty) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          {title}
          {entries.length > 0 ? (
            <span className="ml-2 text-fd-muted-foreground">{entries.length}</span>
          ) : null}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fd-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y divide-fd-border">
            {entries.map((entry) => (
              <CalendarEntryCard key={entry.id} entry={entry} now={now} />
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}

export function CalendarList({ entries, now }: { entries: CalendarEntry[]; now: Date }) {
  const { t } = useTranslation("components/calendar/list");
  const { live, upcoming, past } = splitCalendar(entries, now);
  const sections = [
    <Section key="live" title={t("live")} entries={live} now={now} empty={t("nothing-live")} />,
    <Section key="upcoming" title={t("upcoming")} entries={upcoming} now={now} empty={t("nothing-upcoming")} />,
    past.length > 0 ? (
      <Section key="past" title={t("past", { days: PAST_DAYS })} entries={past} now={now} />
    ) : null,
  ].filter(Boolean);
  return (
    <>
      {sections.map((section, i) => (
        <Fragment key={i}>
          {i > 0 ? <PanelSeparator /> : null}
          {section}
        </Fragment>
      ))}
    </>
  );
}
