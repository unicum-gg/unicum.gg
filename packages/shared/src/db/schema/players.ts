import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

// One physical table per region (eu_players, na_players, asia_players).
// Callers index by region via `playersByRegion[region]`. No `region` column —
// the table name carries that info. We take region as `string` (not the
// `Region` enum) so the resulting table type uses `string` for tableName,
// keeping all 3 regions structurally identical — that way Drizzle's select
// inference treats `playersByRegion[region]` as a single type instead of a
// union of 3 distinct-named tables (which collapses fields to `never`).
export function makePlayersTable(region: string) {
  return pgTable(
    `${region}_players`,
    {
      id: serial("id").primaryKey(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }),
      lastBattleAt: timestamp("last_battle_at", { withTimezone: true }),
      clanId: bigint("clan_id", { mode: "number" }),
      firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      // The wall-clock time this row next becomes due for a snapshot refresh:
      // `last_seen_at + cadence(last_battle_at)` at write time (see dueAtSql in
      // refresh-policy). A row is due when `due_at <= NOW()` — the sargable,
      // index-backed replacement for the old `last_seen_at <
      // refreshCutoffSql(last_battle_at)` predicate, which compared two columns
      // through a CASE and forced a full seq scan of the players table on every
      // pipeline claim. Defaults to epoch so freshly-discovered rows (and any
      // pre-backfill row) read as immediately due.
      dueAt: timestamp("due_at", { withTimezone: true })
        .notNull()
        .default(sql`'epoch'::timestamptz`),
      // Cached ratings — updated by the snapshot-cron whenever a new tank
      // snapshot is recorded. Lets the player page render synchronously and
      // the clan page JOIN for member ratings without per-request compute.
      // `wnx30d` + `battles30d` cover a 30-day window so they line up with
      // the player page "Last 30d" column; the clan aggregate weights
      // members by `battles30d` for a consistent recent view.
      wn7: real("wn7"),
      wn8: real("wn8"),
      wnx: real("wnx"),
      wn730d: real("wn7_30d"),
      wn830d: real("wn8_30d"),
      wnx30d: real("wnx_30d"),
      // Same recent-window ratings for the 24h and 7d leaderboard periods, kept
      // in lockstep by the snapshot pipeline, so the top-players cron ranks by a
      // cached column instead of scanning the 300M-row tank_snapshots table
      // every hour (see wargaming/wot/players/top).
      wn724h: real("wn7_24h"),
      wn824h: real("wn8_24h"),
      wnx24h: real("wnx_24h"),
      wn77d: real("wn7_7d"),
      wn87d: real("wn8_7d"),
      wnx7d: real("wnx_7d"),
      // Lifetime battle count, copied from the latest snapshot's `battles`
      // field at every snapshot-cron tick. Lets the Overall top-players
      // ranking apply the 20k-battle minimum without DISTINCT-ON-scanning
      // the whole player_snapshots table.
      battles: integer("battles"),
      battles30d: integer("battles_30d"),
      battles24h: integer("battles_24h"),
      battles7d: integer("battles_7d"),
      // Lifetime account win rate (0-1), copied from the latest snapshot's
      // wins/battles at every snapshot-cron tick. Powers the "Player WR" column
      // of the per-tank server-average table (average driver account WR).
      winrate: real("winrate"),
      // Steel Hunter (battle royale) leaderboard, kept in lockstep by the
      // snapshot-cron from the latest `fallout_*` snapshot (WG's repurposed
      // Steel Hunter block). `hr` is the computed rating (see computeHR);
      // the raw totals ride along so the board renders winrate/survival/avg
      // damage without a snapshots join, exactly like the wnx columns above let
      // the main top-players board rank by a cached column. Only players with
      // `sh_battles >= HR_MIN_BATTLES` are ranked (the query gates, the
      // partial index below serves it).
      hr: real("hr"),
      shBattles: integer("sh_battles"),
      shWins: integer("sh_wins"),
      shSurvived: integer("sh_survived"),
      shDamage: bigint("sh_damage", { mode: "number" }),
      shFrags: integer("sh_frags"),
      // Average XP per Steel Hunter battle. The XP formula already integrates
      // damage, frags, spotting and placement, so `hr` weighs it as the single
      // effectiveness axis alongside win rate (see computeHR).
      shAvgXp: real("sh_avg_xp"),
      // Hidden/purged-account guard. WG sometimes returns null for an
      // account from /wot/account/info/. Causes: (a) GDPR purge for accounts
      // dormant 10+ years, (b) admin restriction, (c) transient cache miss
      // for active accounts. We increment `nullCount` on each null and only
      // mark `softDeletedAt` after 3 consecutive nulls so transient blips
      // don't take an active player out. Soft-deleted players are excluded
      // from the snapshot cron for 30 days, then re-tried — a successful
      // fetch resets both fields to zero/null.
      nullCount: integer("null_count").notNull().default(0),
      softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
      // Tournament honours, denormalised here so the crest costs nothing to
      // draw. Every table that shows a player already selects from this row,
      // and the alternative is walking the tournament archive's rosters on each
      // render, which is the same trap the clan attribution was pulled out of
      // (see tournaments/clans). Written when a tournament settles, and by the
      // backfill for the archive.
      //
      // `featuredWins` is kept apart because a win is not one thing: taking the
      // nightly gold ladder and taking the AMD Clan Showdown are the same word
      // and not the same achievement, and Wargaming's own `is_featured` is what
      // separates the branded events from the automated dailies.
      tournamentWins: integer("tournament_wins").notNull().default(0),
      tournamentFeaturedWins: integer("tournament_featured_wins")
        .notNull()
        .default(0),
      // The win worth naming in the crest's tooltip: a featured event when
      // there is one, else the most recent. Stored rather than resolved, for
      // the same reason as the counts.
      tournamentBestTitle: text("tournament_best_title"),
      tournamentBestAt: timestamp("tournament_best_at", { withTimezone: true }),
    },
    (t) => [
      uniqueIndex(`${region}_players_account_id_idx`).on(t.accountId),
      // Case-insensitive nickname lookup powers the /<region>/players/<nickname>
      // page. Without it, every page load full-scans the ~1.5M EU rows.
      index(`${region}_players_lower_nickname_idx`).on(sql`LOWER(${t.nickname})`),
      // Nickname prefix search (search dialog). `text_pattern_ops` makes
      // `LOWER(nickname) LIKE 'x%'` a range scan regardless of DB collation, so
      // the local-first search never scans the ~2M rows.
      index(`${region}_players_nickname_prefix_idx`).on(
        sql`LOWER(${t.nickname}) text_pattern_ops`,
      ),
      // Drives the snapshot pipeline's due-player claim. Matches the claim's
      // ORDER BY (last_battle_at DESC NULLS FIRST, last_seen_at ASC), so Postgres
      // walks the index in priority order and stops at the LIMIT instead of a
      // full seq scan + top-N sort of the ~2M rows on every claim.
      index(`${region}_players_due_idx`).on(
        sql`${t.lastBattleAt} DESC NULLS FIRST`,
        sql`${t.lastSeenAt} ASC`,
      ),
      // Serves the pipeline's *backlog* claim (ClaimMode.Backlog), which orders
      // by last_seen_at ASC (longest-overdue first) to drain the recent90d/
      // dormant backlog. The due_idx above can't serve that sort (its leading
      // column is last_battle_at), so without this index the backlog claim would
      // top-N sort the whole due set on every call — the exact Postgres peg the
      // due_idx was added to avoid.
      index(`${region}_players_last_seen_idx`).on(sql`${t.lastSeenAt} ASC`),
      // Drives the sargable due-player filter (`WHERE due_at <= NOW()`). This is
      // the index that replaces the full seq scan: the claim range-scans it to
      // find the (usually small) due set, then the mode's ORDER BY sorts that
      // subset via the two indexes above.
      index(`${region}_players_due_at_idx`).on(sql`${t.dueAt} ASC`),
      // Serves the Steel Hunter (HR) leaderboard:
      // `WHERE sh_battles >= 100 ORDER BY hr DESC LIMIT 100`. Partial (only
      // ranked SH players, a small fraction of the ~2M rows) + DESC so Postgres
      // walks it in board order instead of sorting the whole table. The 100
      // matches HR_MIN_BATTLES.
      index(`${region}_players_hr_idx`)
        .on(sql`${t.hr} DESC NULLS LAST`)
        .where(sql`${t.shBattles} >= 100`),
    ],
  );
}

export type PlayersTable = ReturnType<typeof makePlayersTable>;
export type Player = PlayersTable["$inferSelect"];

export const playersByRegion: Record<Region, PlayersTable> = {
  [Region.EU]: makePlayersTable(Region.EU),
  [Region.NA]: makePlayersTable(Region.NA),
  [Region.ASIA]: makePlayersTable(Region.ASIA),
};
