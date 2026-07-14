import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Refresh queue for clans. Mirrors player_refresh_queue: the refresh-cron
// drains by priority desc then queued_at asc. Higher priority = newer user
// page visit (priority 10); discovery-fed entries sit at priority 0.
export function makeClanRefreshQueueTable(region: string) {
  return pgTable(
    `${region}_clan_refresh_queue`,
    {
      clanId: bigint("clan_id", { mode: "number" }).primaryKey(),
      queuedAt: timestamp("queued_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      priority: integer("priority").notNull().default(0),
    },
    (t) => [
      index(`${region}_clan_refresh_queue_priority_queued_at_idx`).on(
        t.priority,
        t.queuedAt,
      ),
    ],
  );
}

export type ClanRefreshQueueTable = ReturnType<
  typeof makeClanRefreshQueueTable
>;
export type ClanRefreshQueueRow = ClanRefreshQueueTable["$inferSelect"];

export const clanRefreshQueueByRegion: Record<Region, ClanRefreshQueueTable> = {
  [Region.EU]: makeClanRefreshQueueTable(Region.EU),
  [Region.NA]: makeClanRefreshQueueTable(Region.NA),
  [Region.ASIA]: makeClanRefreshQueueTable(Region.ASIA),
};
