import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cronLeader = pgTable(
  "cron_leader",
  {
    id: integer("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [check("cron_leader_singleton", sql`${t.id} = 1`)],
);
