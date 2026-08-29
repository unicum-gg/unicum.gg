import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

export function makeClansTable(region: string) {
  return pgTable(
    `${region}_clans`,
    {
      id: bigint("id", { mode: "number" }).primaryKey(),
      tag: text("tag").notNull(),
      tagLower: text("tag_lower").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      emblem: text("emblem").notNull(),
      motto: text("motto").notNull(),
      descriptionHtml: text("description_html").notNull(),
      membersCount: integer("members_count").notNull(),
      leaderId: bigint("leader_id", { mode: "number" }).notNull(),
      leaderName: text("leader_name").notNull(),
      creatorId: bigint("creator_id", { mode: "number" }).notNull(),
      creatorName: text("creator_name").notNull(),
      createdAtWg: timestamp("created_at_wg", { withTimezone: true }).notNull(),
      isDisbanded: boolean("is_disbanded").notNull().default(false),
      languages: text("languages").array().notNull().default([]),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      // When the FULL clan refresh last ran: info, roster, events, Global Map.
      // The backfill's due-scan reads this, and the clan header shows it as
      // "updated", so anything that stamps it is claiming all of the above is
      // fresh.
      lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
      // When the recent-events feed alone was last pulled. Separate from
      // `last_refreshed_at` because the events refresh fires from any page hit,
      // crawlers included, and used to stamp that column instead: a crawled clan
      // therefore looked freshly refreshed to the backfill scan and got skipped,
      // forever, while only its event feed had actually been updated.
      eventsRefreshedAt: timestamp("events_refreshed_at", {
        withTimezone: true,
      }),
      // When this clan's Stronghold record is next due for a sample. Written by
      // whoever last recorded a snapshot, from the activity cadence in
      // `clans/stronghold-policy`. This column IS the stronghold cron's queue
      // (same trick as `players.due_at`): claiming is an indexed range scan, and
      // a restart loses nothing because the schedule lives in the table.
      //
      // Deliberately NOT `last_refreshed_at`: that one means "the full clan
      // refresh ran", and the events refresh (fired by any page hit, crawlers
      // included) stamps it without going anywhere near the Stronghold host,
      // which is exactly how heavily-crawled clans stayed invisible to the
      // backfill and froze. Defaults to epoch so every existing row is
      // immediately due and the first sweep seeds the real cadence.
      strongholdDueAt: timestamp("stronghold_due_at", { withTimezone: true })
        .notNull()
        .default(new Date(0)),
      // Materialized distinct battle-having vehicle count, written back each
      // time the (heavy) /vehicles aggregation runs, so the clan page can show
      // "Tanks (N)" up front without re-running the ~300M-row DISTINCT ON.
      vehiclesCount: integer("vehicles_count"),
    },
    (t) => [
      uniqueIndex(`${region}_clans_tag_lower_idx`).on(t.tagLower),
      index(`${region}_clans_last_refreshed_at_idx`).on(t.lastRefreshedAt),
      // The stronghold cron's claim: `WHERE stronghold_due_at <= NOW() ORDER BY
      // stronghold_due_at LIMIT n`. Partial on live clans only, a disbanded
      // clan has nothing left to sample, and they are a large enough share to be
      // worth keeping out of the index.
      index(`${region}_clans_stronghold_due_idx`)
        .on(t.strongholdDueAt)
        .where(sql`${t.isDisbanded} = false`),
      // Tag prefix search (search dialog). `text_pattern_ops` makes
      // `tag_lower LIKE 'x%'` a range scan regardless of DB collation.
      index(`${region}_clans_tag_prefix_idx`).on(
        sql`${t.tagLower} text_pattern_ops`,
      ),
    ],
  );
}

export type ClansTable = ReturnType<typeof makeClansTable>;
export type Clan = ClansTable["$inferSelect"];
export type NewClan = ClansTable["$inferInsert"];

export const clansByRegion: Record<Region, ClansTable> = {
  [Region.EU]: makeClansTable(Region.EU),
  [Region.NA]: makeClansTable(Region.NA),
  [Region.ASIA]: makeClansTable(Region.ASIA),
};
