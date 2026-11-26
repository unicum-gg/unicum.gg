import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * One physical table per region (eu_portal_events, na_portal_events, ...): every
 * entry the portal's events widget has ever shown.
 *
 * The widget holds the current week and nothing else: an entry is dropped from
 * the page a day or so after it ends, and there is no archive or endpoint to ask
 * for it afterwards (measured 2026-11-26: EU had dropped "Black Signal" overnight
 * while NA still showed it). So the calendar's past exists only because this
 * table recorded it, and a capture that does not run is a week no later run can
 * recover.
 *
 * Keyed on the article path and the start. The path is the link with its
 * language segment removed (`/news/specials/black-friday-.../`), which is what
 * ties the same entry together across the widget's languages, and the start is
 * what separates two entries pointing at one article (a two-part event under a
 * single news post). Wargaming does move a start after publishing: the capture
 * then marks the old row `superseded_at` rather than keeping both.
 */
export function makePortalEventsTable(region: string) {
  return pgTable(
    `${region}_portal_events`,
    {
      path: text("path").notNull(),
      startAt: timestamp("start_at", { withTimezone: true }).notNull(),
      endAt: timestamp("end_at", { withTimezone: true }).notNull(),
      /** The English title, which is the canonical one. */
      title: text("title").notNull(),
      /** Every title read, keyed by the portal's own language code (`fr`,
       * `pt-br`, `zh-tw`...), English included. Only the languages the region's
       * portal publishes the widget in, so a reader in any other language falls
       * back to `title`. */
      titles: jsonb("titles").$type<Record<string, string>>().notNull(),
      /** The English category label ("Specials", "Battle Pass", "Update"). */
      category: text("category").notNull(),
      /** The widget's own style tokens, verbatim. */
      color: text("color").notNull(),
      icon: text("icon").notNull(),
      /** The English article, absolute. */
      link: text("link").notNull(),
      /** The widget's 200x88 thumbnail. */
      thumbnail: text("thumbnail"),
      /** The article's `og:image` (1022x360 where measured), read once. */
      banner: text("banner"),
      /** Wargaming's own last edit of the entry. */
      editedAt: timestamp("edited_at", { withTimezone: true }),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      /** Set when the same article reappeared under another start: this row is
       * the entry as it stood before Wargaming moved it. */
      supersededAt: timestamp("superseded_at", { withTimezone: true }),
      /** The Discord scheduled event this entry is published as. Entries the
       * regions share point at one event. */
      discordEventId: text("discord_event_id"),
      /** The announcement card posted for it. */
      discordMessageId: text("discord_message_id"),
      /** The entry's state (dates, title) the Discord event was last written
       * from, so an edit on Wargaming's side is told apart from a re-read. */
      discordSyncedHash: text("discord_synced_hash"),
    },
    (t) => [
      primaryKey({ columns: [t.path, t.startAt] }),
      // The calendar reads a time window, and the window is on the end as much
      // as the start: an entry running for three months belongs to every month
      // it spans.
      index(`${region}_portal_events_window_idx`).on(t.startAt, t.endAt),
    ],
  );
}

export type PortalEventsTable = ReturnType<typeof makePortalEventsTable>;
export type PortalEventRow = PortalEventsTable["$inferSelect"];
export type NewPortalEventRow = PortalEventsTable["$inferInsert"];

export const portalEventsByRegion: Record<Region, PortalEventsTable> = {
  [Region.EU]: makePortalEventsTable(Region.EU),
  [Region.NA]: makePortalEventsTable(Region.NA),
  [Region.ASIA]: makePortalEventsTable(Region.ASIA),
};
