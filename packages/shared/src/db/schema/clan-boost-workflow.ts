import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/** One reserve the workflow may activate, in priority order. */
export type BoostReserve = {
  /** WG reserve type, e.g. "ADDITIONAL_BRIEFING" (`type`). */
  type: string;
  /** Preferred level; the runner falls back to the highest in stock. */
  level: number;
};

export enum BoostWorkflowStatus {
  Ok = "ok",
  TokenExpired = "token_expired",
  Error = "error",
}

/**
 * A Stronghold-reserve boost workflow. A clan can have several (keyed by their
 * own `id`, not the clan), so an officer can run different rules — e.g. XP
 * reserves on weekday evenings, credits on weekends. Each is owned by the
 * officer who saved it: their WG token (encrypted in the global `account`
 * table, referenced by `ownerUserId`) both reads the live online roster
 * (`clans/info` extra `private.online_members`) and activates the reserve. The
 * worker's `clan-boosts-<region>` job evaluates every enabled workflow.
 */
export function makeClanBoostWorkflowTable(region: string) {
  return pgTable(
    `${region}_clan_boost_workflow`,
    {
      id: uuid("id").primaryKey().defaultRandom(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      ownerUserId: text("owner_user_id").notNull(),
      ownerAccountId: bigint("owner_account_id", { mode: "number" }).notNull(),
      /** The owner's WG nickname (snapshot), shown as "runs on <name>". */
      ownerName: text("owner_name").notNull().default(""),
      /** Officer-facing label to tell workflows apart. */
      name: text("name").notNull().default(""),
      enabled: boolean("enabled").notNull().default(true),

      /** IANA timezone the window is expressed in. */
      timezone: text("timezone").notNull().default("Europe/Paris"),
      /** Active weekdays as a bitmask, Mon=bit0 … Sun=bit6. 127 = every day. */
      days: smallint("days").notNull().default(127),
      /** Window bounds as minutes-from-local-midnight (e.g. 1080 = 18:00). */
      windowStart: integer("window_start").notNull(),
      windowEnd: integer("window_end").notNull(),
      /** Min clan members with a live in-game session to trigger. */
      minOnline: integer("min_online").notNull().default(10),
      /** Reserves to activate when the workflow fires, in priority order. */
      reserves: jsonb("reserves").$type<BoostReserve[]>().notNull().default([]),

      status: text("status").notNull().default(BoostWorkflowStatus.Ok),
      lastError: text("last_error"),
      lastOnlineCount: integer("last_online_count"),
      lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
      lastActivatedAt: timestamp("last_activated_at", { withTimezone: true }),

      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [index(`${region}_clan_boost_workflow_clan_idx`).on(t.clanId)],
  );
}

export type ClanBoostWorkflowTable = ReturnType<
  typeof makeClanBoostWorkflowTable
>;
export type ClanBoostWorkflow = ClanBoostWorkflowTable["$inferSelect"];
export type NewClanBoostWorkflow = ClanBoostWorkflowTable["$inferInsert"];

export const clanBoostWorkflowByRegion: Record<Region, ClanBoostWorkflowTable> =
  {
    [Region.EU]: makeClanBoostWorkflowTable(Region.EU),
    [Region.NA]: makeClanBoostWorkflowTable(Region.NA),
    [Region.ASIA]: makeClanBoostWorkflowTable(Region.ASIA),
  };
