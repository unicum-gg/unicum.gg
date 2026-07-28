import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * Where a clan's Stronghold boost activations get posted on Discord — our bot
 * posts there directly (no webhook). One destination per clan, set by an
 * officer who picked a server (our bot must be a member) + channel. Names are
 * snapshotted so the console can show them without re-hitting Discord.
 */
export function makeClanBoostDiscordTable(region: string) {
  return pgTable(`${region}_clan_boost_discord`, {
    clanId: bigint("clan_id", { mode: "number" }).primaryKey(),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    guildName: text("guild_name").notNull().default(""),
    channelName: text("channel_name").notNull().default(""),
    setByUserId: text("set_by_user_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export type ClanBoostDiscordTable = ReturnType<
  typeof makeClanBoostDiscordTable
>;
export type ClanBoostDiscord = ClanBoostDiscordTable["$inferSelect"];
export type NewClanBoostDiscord = ClanBoostDiscordTable["$inferInsert"];

export const clanBoostDiscordByRegion: Record<Region, ClanBoostDiscordTable> = {
  [Region.EU]: makeClanBoostDiscordTable(Region.EU),
  [Region.NA]: makeClanBoostDiscordTable(Region.NA),
  [Region.ASIA]: makeClanBoostDiscordTable(Region.ASIA),
};
