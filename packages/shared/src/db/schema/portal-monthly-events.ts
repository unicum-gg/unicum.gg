import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * One physical table per region (eu_portal_monthly_events, ...): every entry of
 * the "WoT Monthly" articles' calendars.
 *
 * The second source of the calendar page, beside `*_portal_events` (the home
 * page widget). Far richer (tournaments, livestreams, national days, partner
 * offers: 12 entries in November 2026 against the widget's 4) but dated by the
 * day rather than the minute, and unlike the widget it stays online after its
 * month, so the table can be backfilled to March 2025, when the widget format
 * began.
 *
 * Keyed on the month, the first day and the English title. The title rather
 * than the position, because Wargaming adds entries through the month ("return
 * throughout the month"), which can shift every position after them; the first
 * day as well, because one month can carry the same title twice (two runs of
 * one Arcade Cabinet mode in November 2025). An entry missing from a later read
 * of its own month is marked `removed_at` rather than deleted.
 */
export function makePortalMonthlyEventsTable(region: string) {
  return pgTable(
    `${region}_portal_monthly_events`,
    {
      /** The article's month, `YYYY-MM`. An entry can spill past it. */
      period: text("period").notNull(),
      startDate: date("start_date").notNull(),
      /** Inclusive: a two-day final runs 7 to 8. */
      endDate: date("end_date").notNull(),
      /** The English title, which is the canonical one. */
      title: text("title").notNull(),
      /** Every title read, keyed by the portal's own language code. */
      titles: jsonb("titles").$type<Record<string, string>>().notNull(),
      descriptions: jsonb("descriptions").$type<Record<string, string>>().notNull(),
      /** Its place in the article, for a stable order within a day. */
      position: integer("position").notNull(),
      /** The English label, loosely worded by the editors; `icon` is the
       * stable field. */
      category: text("category").notNull(),
      color: text("color").notNull(),
      icon: text("icon").notNull(),
      image: text("image"),
      /** The "learn more" link, when the entry has one. */
      link: text("link"),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      removedAt: timestamp("removed_at", { withTimezone: true }),
    },
    (t) => [
      primaryKey({ columns: [t.period, t.startDate, t.title] }),
      index(`${region}_portal_monthly_events_window_idx`).on(t.startDate, t.endDate),
    ],
  );
}

export type PortalMonthlyEventsTable = ReturnType<typeof makePortalMonthlyEventsTable>;
export type PortalMonthlyEventRow = PortalMonthlyEventsTable["$inferSelect"];

export const portalMonthlyEventsByRegion: Record<Region, PortalMonthlyEventsTable> = {
  [Region.EU]: makePortalMonthlyEventsTable(Region.EU),
  [Region.NA]: makePortalMonthlyEventsTable(Region.NA),
  [Region.ASIA]: makePortalMonthlyEventsTable(Region.ASIA),
};
