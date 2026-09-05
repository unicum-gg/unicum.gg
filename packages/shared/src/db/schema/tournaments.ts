import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  Region,
  type TournamentPrizeTier,
  type TournamentRulesSection,
} from "@unicum.gg/wargaming";

/**
 * Wargaming's own tournaments, mirrored from the tournament system
 * (`worldoftanks.<tld>/tmsis/`). Per region because a tournament is run on one
 * realm and its teams are that realm's accounts.
 *
 * The archive is the point: a finished bracket is never published anywhere else
 * and never changes again, while Wargaming's own pages render the rosters and
 * brackets client-side, so nothing about who played and who won survives
 * outside this mirror. Rosters carry account ids, which is what lets a
 * tournament record hang off the player and clan pages we already have.
 */
export function makeTournamentsTable(region: string) {
  return pgTable(
    `${region}_tournaments`,
    {
      // The tournament system's own id, kept as the primary key so every child
      // row references the same id the source does.
      id: bigint("id", { mode: "number" }).primaryKey(),
      title: text("title").notNull(),
      // Raw HTML, as the organiser entered it. Sanitize at render.
      description: text("description").notNull().default(""),
      // The language the title and description were read in. Every tournament
      // is fetched in English, so this records which text we hold rather than
      // which translations exist.
      language: text("language").notNull().default("en"),
      // Lifecycle: upcoming / registration_started / registration_finished /
      // running / finished / complete. `complete` is the settled state, and the
      // sync treats it as immutable: those rows are never refetched.
      status: text("status").notNull(),
      // Arena gameplay codes (`comp7`, `domination`, `assault2`, `ctf`). Almost
      // always one, but the format allows several.
      gameModes: text("game_modes").array().notNull().default([]),
      // Null when the organiser left that bound open, which is rare but real.
      // A missing floor is not tier 1: it is no floor.
      tierFrom: integer("tier_from"),
      tierTo: integer("tier_to"),
      minPlayersInTeam: integer("min_players_in_team").notNull(),
      maxPlayersInTeam: integer("max_players_in_team").notNull(),
      // Entrant cap, null when the tournament sets none (the usual case).
      teamsLimit: integer("teams_limit"),
      confirmedTeams: integer("confirmed_teams").notNull().default(0),
      startAt: timestamp("start_at", { withTimezone: true }).notNull(),
      endAt: timestamp("end_at", { withTimezone: true }).notNull(),
      registrationFrom: timestamp("registration_from", { withTimezone: true }),
      registrationTill: timestamp("registration_till", { withTimezone: true }),
      // The reward as the organiser wrote it ("Gold", "Gold + Bonds + Cash!").
      prize: text("prize"),
      // The structured breakdown per placement band, when the organiser filled
      // one in. Free text per line, so this is display material, not amounts to
      // sum: "500,000 Gold + 100,000 Bonds + 10,000€" is one string.
      prizeTiers: jsonb("prize_tiers").$type<TournamentPrizeTier[]>(),
      rules: jsonb("rules").$type<TournamentRulesSection[]>(),
      tags: jsonb("tags").$type<{ id: number; name: string }[]>(),
      logoUrl: text("logo_url"),
      isFeatured: boolean("is_featured").notNull().default(false),
      // Arena ids of the maps this tournament is played on, the same keys the
      // map catalogue uses, so a tournament joins onto the map pages.
      mapPool: text("map_pool").array(),
      // Bracket types across its stages (`SE` / `DE` / `RR`).
      bracketTypes: text("bracket_types").array(),
      // Total tier points a team may field at once, when the format caps it.
      totalLevelFrom: integer("total_level_from"),
      totalLevelTo: integer("total_level_to"),
      // Named session times ("EU 2"), for a tournament run across several.
      schedule: jsonb("schedule").$type<{ title: string; startAt: string }[]>(),
      // Null until the detail endpoint has been read: the catalogue sweep writes
      // the summary for every tournament it sees, and the per-tournament fetch
      // (detail, teams, bracket) fills the rest. So this is what tells a row
      // that is merely listed from a row that is fully mirrored, and what the
      // backfill claims its next batch on.
      detailSyncedAt: timestamp("detail_synced_at", { withTimezone: true }),
      syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      // The catalogue read: a status bucket, newest first.
      index(`${region}_tournaments_status_start_idx`).on(t.status, t.startAt.desc()),
      // The whole archive by date, for the cross-status listing.
      index(`${region}_tournaments_start_idx`).on(t.startAt.desc()),
      // The backfill claim: rows listed but not yet mirrored in full.
      index(`${region}_tournaments_detail_sync_idx`).on(t.detailSyncedAt),
    ],
  );
}

export type TournamentsTable = ReturnType<typeof makeTournamentsTable>;

export const tournamentsByRegion: Record<Region, TournamentsTable> = {
  [Region.EU]: makeTournamentsTable(Region.EU),
  [Region.NA]: makeTournamentsTable(Region.NA),
  [Region.ASIA]: makeTournamentsTable(Region.ASIA),
};

/**
 * One team entered in a tournament. Teams are formed per tournament, not
 * persistent: the same five players enter next week's under a new name and a new
 * id, so a team row is an entry rather than an organisation.
 *
 * The captain's `contacts` field is deliberately absent. The endpoint returns it
 * (a Discord handle, a phone number), but it is contact detail a player gave to
 * be reached during their tournament, not something they published.
 */
export function makeTournamentTeamsTable(region: string) {
  return pgTable(
    `${region}_tournament_teams`,
    {
      id: bigint("id", { mode: "number" }).primaryKey(),
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      title: text("title").notNull(),
      // forming / confirmed / disqualified. Only confirmed teams are drawn.
      status: text("status").notNull(),
      // The captain, who registered the team and picks its lineup.
      ownerAccountId: bigint("owner_account_id", { mode: "number" }),
      playersCount: integer("players_count").notNull().default(0),
      maxPlayers: integer("max_players").notNull().default(0),
      // The captain's team blurb, free text, usually empty.
      description: text("description"),
      isPasswordProtected: boolean("is_password_protected").notNull().default(false),
      disqualifyReason: text("disqualify_reason"),
      // The clan behind the team, recovered by matching the roster against clan
      // membership ON THE DAY it was played (migration 0094). Nullable and not a
      // foreign key: a mixed team has no clan, a team split evenly between two
      // has none either, and the clan may be one we never mirrored.
      clanId: bigint("clan_id", { mode: "number" }),
      clanMembers: integer("clan_members"),
      // When the attribution was computed. Distinct from `clanId IS NULL`, which
      // is the real answer "no clan" rather than "not looked at yet", and it is
      // what lets the backfill claim only what it has not done.
      clanResolvedAt: timestamp("clan_resolved_at", { withTimezone: true }),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index(`${region}_tournament_teams_tournament_idx`).on(t.tournamentId),
      index(`${region}_tournament_teams_clan_id_idx`).on(t.clanId),
      // A captain's entries, for the player page's tournament record.
      index(`${region}_tournament_teams_owner_idx`).on(t.ownerAccountId),
    ],
  );
}

export type TournamentTeamsTable = ReturnType<typeof makeTournamentTeamsTable>;

export const tournamentTeamsByRegion: Record<Region, TournamentTeamsTable> = {
  [Region.EU]: makeTournamentTeamsTable(Region.EU),
  [Region.NA]: makeTournamentTeamsTable(Region.NA),
  [Region.ASIA]: makeTournamentTeamsTable(Region.ASIA),
};

/**
 * A roster line: one account on one team. This is the join onto everything else
 * we hold, and the reason the whole mirror is worth keeping.
 *
 * `nickname` is the name the account carried when the roster was read, kept
 * verbatim rather than resolved live: players rename, and a bracket from 2019
 * should read as it was played. The current name comes from the players table
 * on the `account_id` join.
 */
export function makeTournamentTeamPlayersTable(region: string) {
  return pgTable(
    `${region}_tournament_team_players`,
    {
      tournamentId: bigint("tournament_id", { mode: "number" }).notNull(),
      teamId: bigint("team_id", { mode: "number" }).notNull(),
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      nickname: text("nickname").notNull(),
      // "owner" for the captain, empty for a plain member.
      role: text("role").notNull().default(""),
    },
    (t) => [
      primaryKey({ columns: [t.teamId, t.accountId] }),
      // The player page's read: every tournament this account has entered.
      index(`${region}_tournament_team_players_account_idx`).on(t.accountId),
      // Rewriting one tournament's rosters, and reading a team's lineup.
      index(`${region}_tournament_team_players_tournament_idx`).on(t.tournamentId),
    ],
  );
}

export type TournamentTeamPlayersTable = ReturnType<typeof makeTournamentTeamPlayersTable>;

export const tournamentTeamPlayersByRegion: Record<Region, TournamentTeamPlayersTable> = {
  [Region.EU]: makeTournamentTeamPlayersTable(Region.EU),
  [Region.NA]: makeTournamentTeamPlayersTable(Region.NA),
  [Region.ASIA]: makeTournamentTeamPlayersTable(Region.ASIA),
};
