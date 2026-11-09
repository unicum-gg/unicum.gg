import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// Maneuvers: the recurring Stronghold clan event, run once or twice a year.
//
// Wargaming publishes two boards for it, players and clans, and keeps neither:
// the moment an edition closes, "how many Fame Points did it take to hold a
// rewarded place, and when did that line move" is unanswerable from any source.
// A private feeder walks both boards on a timer and writes them here, which is
// what gives the site a live board during an edition and an archive afterwards.
//
// Every table is keyed by `event_name` (the edition's own identifier, e.g.
// `stronghold_event_2026_autumn`), so a new edition sits alongside the finished
// ones rather than wiping them, exactly as the Onslaught tables are keyed by
// season.

/** The edition being run: its dates, and what it rewards. */
export function makeManeuversEditionsTable(region: string) {
  return pgTable(`${region}_maneuvers_editions`, {
    eventName: text("event_name").primaryKey(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    // The tiers an edition is played at (XI for the 2026 autumn one).
    vehicleLevels: integer("vehicle_levels").array(),
    // How many places are rewarded. Set per region and changed between
    // editions (9000 players / 400 clans on EU in autumn 2026, against
    // 1000 / 50 on Asia), which is why it is recorded beside the standings
    // rather than assumed.
    tankRewardPositions: integer("tank_reward_positions"),
    clanGoldPositions: integer("clan_gold_positions"),
    accountBondsPercent: integer("account_bonds_percent"),
    clanBondsPercent: integer("clan_bonds_percent"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

/** The player board as it stands now, one row per ranked player. */
export function makeManeuversPlayersTable(region: string) {
  return pgTable(
    `${region}_maneuvers_players`,
    {
      eventName: text("event_name").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      // Board position (1-based), as served by the source.
      place: integer("place").notNull(),
      // Fame Points, the ranking metric. `bigint` because it is a cumulative
      // counter over a two-week edition and nothing caps it.
      famePoints: bigint("fame_points", { mode: "number" }).notNull(),
      // Nickname and clan as the board carried them at fetch time; players
      // rename and change clans, so these are a snapshot, not an identity.
      nickname: text("nickname"),
      clanId: bigint("clan_id", { mode: "number" }),
      clanTag: text("clan_tag"),
      victories: integer("victories").notNull().default(0),
      defeats: integer("defeats").notNull().default(0),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.eventName, t.accountId] }),
      // Default board read: WHERE event_name = $1 ORDER BY place ASC.
      index(`${region}_maneuvers_players_event_place_idx`).on(
        t.eventName,
        t.place.asc(),
      ),
      // The transpose, which a player page asks: every edition an account
      // placed in. The key's own prefix cannot serve it.
      index(`${region}_maneuvers_players_account_idx`).on(t.accountId),
      // A clan's members on the player board, which is the one view a clan
      // page wants and neither index above answers.
      index(`${region}_maneuvers_players_clan_idx`).on(t.eventName, t.clanId),
    ],
  );
}

/**
 * One row per player per instant their standing moved.
 *
 * `captured_at` is the source's own recomputation stamp rather than our clock,
 * so two passes landing between two recomputations carry the same instant and
 * the key absorbs the second instead of inventing a change.
 */
export function makeManeuversPlayerHistoryTable(region: string) {
  return pgTable(
    `${region}_maneuvers_player_history`,
    {
      eventName: text("event_name").notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
      place: integer("place").notNull(),
      famePoints: bigint("fame_points", { mode: "number" }).notNull(),
      victories: integer("victories").notNull().default(0),
      defeats: integer("defeats").notNull().default(0),
    },
    (t) => [
      primaryKey({ columns: [t.eventName, t.accountId, t.capturedAt] }),
      // One player's curve over an edition, in order.
      index(`${region}_maneuvers_player_history_account_idx`).on(
        t.accountId,
        t.capturedAt.asc(),
      ),
    ],
  );
}

/** The clan board as it stands now, one row per ranked clan. */
export function makeManeuversClansTable(region: string) {
  return pgTable(
    `${region}_maneuvers_clans`,
    {
      eventName: text("event_name").notNull(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      place: integer("place").notNull(),
      famePoints: bigint("fame_points", { mode: "number" }).notNull(),
      tag: text("tag"),
      name: text("name"),
      victories: integer("victories").notNull().default(0),
      defeats: integer("defeats").notNull().default(0),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.eventName, t.clanId] }),
      index(`${region}_maneuvers_clans_event_place_idx`).on(
        t.eventName,
        t.place.asc(),
      ),
      index(`${region}_maneuvers_clans_clan_idx`).on(t.clanId),
    ],
  );
}

/** One row per clan per instant its standing moved. */
export function makeManeuversClanHistoryTable(region: string) {
  return pgTable(
    `${region}_maneuvers_clan_history`,
    {
      eventName: text("event_name").notNull(),
      clanId: bigint("clan_id", { mode: "number" }).notNull(),
      capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
      place: integer("place").notNull(),
      famePoints: bigint("fame_points", { mode: "number" }).notNull(),
      victories: integer("victories").notNull().default(0),
      defeats: integer("defeats").notNull().default(0),
    },
    (t) => [
      primaryKey({ columns: [t.eventName, t.clanId, t.capturedAt] }),
      index(`${region}_maneuvers_clan_history_clan_idx`).on(
        t.clanId,
        t.capturedAt.asc(),
      ),
    ],
  );
}

/**
 * Both boards as a whole, once per pass.
 *
 * This is the table the source has no equivalent of. A standing answers "where
 * am I"; these rows answer "what does a rewarded place cost right now, and
 * which way is that line moving", which is the question an edition is actually
 * played against and the one nobody can reconstruct afterwards. One row per
 * pass is nothing beside the history tables next to it.
 */
export function makeManeuversSnapshotsTable(region: string) {
  return pgTable(
    `${region}_maneuvers_snapshots`,
    {
      eventName: text("event_name").notNull(),
      capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
      playerCount: integer("player_count").notNull(),
      // The population before the board's own filtering. The gap between the
      // two is the qualification gate doing its work.
      playerUnfilteredCount: integer("player_unfiltered_count"),
      clanCount: integer("clan_count").notNull(),
      clanUnfilteredCount: integer("clan_unfiltered_count"),
      // Fame Points sitting at the last rewarded place, read off the board
      // itself: settings publishes the POSITION, only the board knows what it
      // currently costs.
      tankCutoffPoints: bigint("tank_cutoff_points", { mode: "number" }),
      clanGoldCutoffPoints: bigint("clan_gold_cutoff_points", {
        mode: "number",
      }),
      topPlayerPoints: bigint("top_player_points", { mode: "number" }),
      topClanPoints: bigint("top_clan_points", { mode: "number" }),
      // Summed over the player board: the edition's total output, which is how
      // one edition is compared to the last.
      totalFamePoints: bigint("total_fame_points", { mode: "number" }),
    },
    (t) => [
      primaryKey({ columns: [t.eventName, t.capturedAt] }),
      index(`${region}_maneuvers_snapshots_event_idx`).on(
        t.eventName,
        t.capturedAt.asc(),
      ),
    ],
  );
}

export type ManeuversEditionsTable = ReturnType<
  typeof makeManeuversEditionsTable
>;
export type ManeuversPlayersTable = ReturnType<
  typeof makeManeuversPlayersTable
>;
export type ManeuversPlayerHistoryTable = ReturnType<
  typeof makeManeuversPlayerHistoryTable
>;
export type ManeuversClansTable = ReturnType<typeof makeManeuversClansTable>;
export type ManeuversClanHistoryTable = ReturnType<
  typeof makeManeuversClanHistoryTable
>;
export type ManeuversSnapshotsTable = ReturnType<
  typeof makeManeuversSnapshotsTable
>;

export const maneuversEditionsByRegion: Record<Region, ManeuversEditionsTable> =
  {
    [Region.EU]: makeManeuversEditionsTable(Region.EU),
    [Region.NA]: makeManeuversEditionsTable(Region.NA),
    [Region.ASIA]: makeManeuversEditionsTable(Region.ASIA),
  };

export const maneuversPlayersByRegion: Record<Region, ManeuversPlayersTable> = {
  [Region.EU]: makeManeuversPlayersTable(Region.EU),
  [Region.NA]: makeManeuversPlayersTable(Region.NA),
  [Region.ASIA]: makeManeuversPlayersTable(Region.ASIA),
};

export const maneuversPlayerHistoryByRegion: Record<
  Region,
  ManeuversPlayerHistoryTable
> = {
  [Region.EU]: makeManeuversPlayerHistoryTable(Region.EU),
  [Region.NA]: makeManeuversPlayerHistoryTable(Region.NA),
  [Region.ASIA]: makeManeuversPlayerHistoryTable(Region.ASIA),
};

export const maneuversClansByRegion: Record<Region, ManeuversClansTable> = {
  [Region.EU]: makeManeuversClansTable(Region.EU),
  [Region.NA]: makeManeuversClansTable(Region.NA),
  [Region.ASIA]: makeManeuversClansTable(Region.ASIA),
};

export const maneuversClanHistoryByRegion: Record<
  Region,
  ManeuversClanHistoryTable
> = {
  [Region.EU]: makeManeuversClanHistoryTable(Region.EU),
  [Region.NA]: makeManeuversClanHistoryTable(Region.NA),
  [Region.ASIA]: makeManeuversClanHistoryTable(Region.ASIA),
};

export const maneuversSnapshotsByRegion: Record<
  Region,
  ManeuversSnapshotsTable
> = {
  [Region.EU]: makeManeuversSnapshotsTable(Region.EU),
  [Region.NA]: makeManeuversSnapshotsTable(Region.NA),
  [Region.ASIA]: makeManeuversSnapshotsTable(Region.ASIA),
};

/**
 * Where a session token for the feeder is deposited, one row per region.
 *
 * Global rather than per-region-prefixed: it holds no game data, only the
 * handover between whatever obtains a token and the job that spends it, and
 * the region is a column because that is all it varies by.
 *
 * The token cannot be minted server-side (the gateway rejects tokens issued to
 * third-party applications), so it necessarily comes from a game client. This
 * table is the seam that lets the source of it change without the feeder
 * moving.
 */
export const maneuversTokens = pgTable("maneuvers_tokens", {
  region: text("region").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Which account the token was issued for, so a deposit can be traced back
  // and a revoked one recognised.
  accountId: bigint("account_id", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
