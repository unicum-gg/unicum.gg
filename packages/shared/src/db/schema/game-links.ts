import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * A World of Tanks client linked to a unicum.gg account, so the mod can act for
 * the player (send a message to their Twitch chat from a battle).
 *
 * The mod draws a random secret, keeps it, and sends only its SHA-256 through
 * the sign-in chain it opens in the game's browser; that hash is what is stored
 * here. The secret itself never reaches the server until the mod uses it as a
 * bearer token, and a row leaked from this table cannot be replayed.
 *
 * Global, like the auth tables it hangs off: a unicum.gg user is region-less
 * even though the WG account behind it is not.
 */
export const gameLinks = pgTable(
  "game_links",
  {
    /** SHA-256 of the mod's secret, hex. */
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("game_links_user_id_idx").on(t.userId)],
);
