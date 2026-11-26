import { bigint, date, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * The days each signed-in account was seen on the site, one row per (day,
 * account).
 *
 * Better Auth's own tables cannot answer "how many people used the site this
 * week". `session.updated_at` only moves when the session is extended, about
 * once a day, and an expired session is deleted, so the table holds the
 * present and forgets the past. Signups are the one usage figure with a history
 * of their own (`user.created_at`); everything about returning readers has to
 * be recorded as it happens, which is this table.
 *
 * A row per day rather than a counter, so the 7- and 30-day figures are
 * distinct readers and not a sum of daily ones counting the same person seven
 * times. Written at most once per account per day per process (see
 * `recordUserActivity`), and the primary key absorbs the rest.
 */
export const userActivityDay = pgTable(
  "user_activity_day",
  {
    day: date("day", { mode: "string" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.day, t.userId] })],
);

/** What a `usage_daily` row measures. Text in the table rather than a pg enum,
 * so a new figure is a constant and not a migration. */
export enum UsageMetric {
  /** Servers the Discord bot is in, sampled through the day. A gauge: the
   * day's row holds the latest reading. */
  BotGuilds = "bot-guilds",
  /** Slash commands the bot answered, keyed by the command's name. A counter:
   * every invocation adds one to the day's row. */
  BotCommands = "bot-commands",
}

/**
 * Day-by-day figures nobody else keeps, in one global table.
 *
 * Discord reports how many servers the bot is in right now and nothing about
 * yesterday, and the bot never writes anything of its own, so both have to be
 * recorded here or they do not exist. A day that was not recorded is a day no
 * later run can fill in, the same position as the servers' population.
 *
 * `key` splits a metric when it has parts (the command's name) and is empty
 * when it has none.
 */
export const usageDaily = pgTable(
  "usage_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    metric: text("metric").notNull(),
    key: text("key").notNull().default(""),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric, t.key] })],
);
