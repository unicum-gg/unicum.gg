import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const clanMembers = pgTable(
  "clan_members",
  {
    region: text("region").notNull(),
    clanId: bigint("clan_id", { mode: "number" }).notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    roleLocalized: text("role_localized").notNull(),
    roleRank: integer("role_rank").notNull(),
    daysInClan: integer("days_in_clan").notNull(),
    lastBattleTime: timestamp("last_battle_time", { withTimezone: true }),
    personalRating: integer("personal_rating"),

    overallBattles: integer("overall_battles"),
    overallWinsPct: real("overall_wins_pct"),
    overallDamagePerBattle: real("overall_damage_per_battle"),
    overallExpPerBattle: real("overall_exp_per_battle"),
    overallFragsPerBattle: real("overall_frags_per_battle"),
    overallBattlesPerDay: real("overall_battles_per_day"),

    d28Battles: integer("d28_battles"),
    d28WinsPct: real("d28_wins_pct"),
    d28DamagePerBattle: real("d28_damage_per_battle"),
    d28ExpPerBattle: real("d28_exp_per_battle"),
    d28FragsPerBattle: real("d28_frags_per_battle"),
    d28BattlesPerDay: real("d28_battles_per_day"),

    refreshedAt: timestamp("refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.region, t.clanId, t.accountId] })],
);

export type ClanMember = typeof clanMembers.$inferSelect;
export type NewClanMember = typeof clanMembers.$inferInsert;
