import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// User-initiated and cron-initiated player refreshes queue. The refresh-cron
// drains by priority desc then queued_at asc.
export function makePlayerRefreshQueueTable(region: string) {
  return pgTable(
    `${region}_player_refresh_queue`,
    {
      accountId: bigint("account_id", { mode: "number" }).primaryKey(),
      queuedAt: timestamp("queued_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      priority: integer("priority").notNull().default(0),
    },
    (t) => [
      index(`${region}_player_refresh_queue_priority_queued_at_idx`).on(
        t.priority,
        t.queuedAt,
      ),
    ],
  );
}

export type PlayerRefreshQueueTable = ReturnType<
  typeof makePlayerRefreshQueueTable
>;
export type PlayerRefreshQueueRow = PlayerRefreshQueueTable["$inferSelect"];

export const playerRefreshQueueByRegion: Record<
  Region,
  PlayerRefreshQueueTable
> = {
  [Region.EU]: makePlayerRefreshQueueTable(Region.EU),
  [Region.NA]: makePlayerRefreshQueueTable(Region.NA),
  [Region.ASIA]: makePlayerRefreshQueueTable(Region.ASIA),
};
