"use client";

import { CalendarKind, calendarKind } from "@unicum.gg/shared";
import { useMemo, useState } from "react";
import { Panel, PanelSeparator } from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTranslation } from "@/hooks/use-translation";
import type { CalendarEntry } from "./entry-card";
import { CalendarList } from "./list";
import { CalendarMonth } from "./month";

enum CalendarView {
  List = "list",
  Month = "month",
}

const ALL = "all";
type KindFilter = CalendarKind | typeof ALL;

/** The kinds offered as filters, in the order a reader looks for them. Other is
 * left to "All": it is whatever Wargaming adds next, and has no name yet. */
const KINDS = [
  CalendarKind.Event,
  CalendarKind.Specials,
  CalendarKind.Update,
  CalendarKind.BattlePass,
] as const;

export function CalendarBoard({
  entries,
  renderedAt,
  recordedSince,
}: {
  entries: CalendarEntry[];
  /** The instant the page was rendered, used until hydration so the server's
   * HTML and the first client render sort the entries the same way. */
  renderedAt: Date;
  recordedSince: Date | null;
}) {
  const { t } = useTranslation("components/calendar/board");
  const { t: tKind } = useTranslation("components/calendar/entry-card");
  const hydrated = useHydrated();
  const now = useMemo(() => (hydrated ? new Date() : renderedAt), [hydrated, renderedAt]);
  const [view, setView] = useState(CalendarView.List);
  const [kind, setKind] = useState<KindFilter>(ALL);

  const counts = useMemo(() => {
    const byKind = new Map<CalendarKind, number>();
    for (const entry of entries) {
      const k = calendarKind(entry.icon);
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }
    return byKind;
  }, [entries]);
  const shown = useMemo(
    () => (kind === ALL ? entries : entries.filter((e) => calendarKind(e.icon) === kind)),
    [entries, kind],
  );

  return (
    <>
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <SegmentedControl
          segments={[
            { id: ALL as KindFilter, label: t("all") },
            ...KINDS.filter((k) => counts.has(k)).map((k) => ({
              id: k as KindFilter,
              label: tKind(`kind.${k}`),
              count: counts.get(k),
            })),
          ]}
          active={kind}
          onSelect={setKind}
        />
        <SegmentedControl
          segments={[
            { id: CalendarView.List, label: t("view.list") },
            { id: CalendarView.Month, label: t("view.month") },
          ]}
          active={view}
          onSelect={setView}
        />
      </Panel>
      <PanelSeparator />
      {view === CalendarView.List ? (
        <CalendarList entries={shown} now={now} />
      ) : (
        <CalendarMonth entries={shown} now={now} recordedSince={recordedSince} />
      )}
    </>
  );
}
