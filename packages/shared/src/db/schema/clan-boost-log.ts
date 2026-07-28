import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * Append-only log of the Stronghold reserves a workflow activated. WG exposes
 * no reserve-activation history, so the worker records its own — one row per
 * activated reserve — for the officer console's "recent activations" panel.
 * Self-contained (name/percent snapshotted) so it renders without re-fetching
 * reserve metadata, and survives the workflow being renamed or deleted.
 */
export function makeClanBoostLogTable(region: string) {
  return pgTable(
    `${region}_clan_boost_log`,
    {
      id: uuid("id").primaryKey().defaultRandom(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      workflowId: uuid("workflow_id"),
      workflowName: text("workflow_name").notNull().default(""),
      reserveType: text("reserve_type").notNull(),
      reserveName: text("reserve_name").notNull(),
      reserveLevel: integer("reserve_level").notNull(),
      /** Boost strength at activation (e.g. 400 = +400%), if known. */
      percent: integer("percent"),
      /** Members with a live game session when it fired. */
      onlineCount: integer("online_count").notNull(),
      activatedAt: timestamp("activated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index(`${region}_clan_boost_log_clan_idx`).on(t.clanId, t.activatedAt),
    ],
  );
}

export type ClanBoostLogTable = ReturnType<typeof makeClanBoostLogTable>;
export type ClanBoostLogEntry = ClanBoostLogTable["$inferSelect"];
export type NewClanBoostLogEntry = ClanBoostLogTable["$inferInsert"];

export const clanBoostLogByRegion: Record<Region, ClanBoostLogTable> = {
  [Region.EU]: makeClanBoostLogTable(Region.EU),
  [Region.NA]: makeClanBoostLogTable(Region.NA),
  [Region.ASIA]: makeClanBoostLogTable(Region.ASIA),
};
