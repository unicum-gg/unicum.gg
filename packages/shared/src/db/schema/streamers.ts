import {
  pgTable,
  text,
  bigint,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Maps a WoT account to a Twitch channel, so the "top players streaming now"
 * surfaces can join live status to our ratings. Global table (Twitch identity
 * is region-agnostic) but each row points at one per-region WoT account.
 *
 * `id` is `${region}-${accountId}` — the same key shape Better Auth uses for the
 * user id, so a self-service Twitch link upserts the very row a curated seed
 * created. `verified` is true only for owner-confirmed links (Twitch OAuth);
 * curated seeds stay false.
 *
 * `twitch_login` is intentionally NOT unique: one streamer can play (and stream)
 * across several WoT accounts, so multiple rows may share a channel. The home
 * rail collapses them to one card per live channel, showing the most active
 * account (see `getLiveStreamers`).
 */
export const streamers = pgTable(
  "streamers",
  {
    id: text("id").primaryKey(),
    region: text("region").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    // Canonical lowercase Twitch login (used for the Helix query and the embed).
    twitchLogin: text("twitch_login").notNull(),
    // Stable numeric Twitch user id; resolved lazily (logins can change).
    twitchUserId: text("twitch_user_id"),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [index("streamers_twitch_login_idx").on(t.twitchLogin)],
);
