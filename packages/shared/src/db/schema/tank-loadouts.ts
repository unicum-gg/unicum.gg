import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";
import { user } from "./auth";

/**
 * How a player has set one of their vehicles up: its modules, its crew's
 * skills, its field modifications, and what it carries into battle.
 *
 * Wargaming publishes none of this about anyone. The API answers battles and
 * damage, never the equipment on a gun or the perks a commander trained, so a
 * row here exists only because that player runs the unicum.gg mod, which reads
 * it from their own client and sends it up. The mod is the only source and
 * there is no backfill: a tank nobody with the mod owns has no loadouts, and
 * always will have none.
 *
 * Per region like the players it hangs off, keyed on the Wargaming account id
 * rather than on a unicum.gg user, because most of the people this describes
 * have never signed in here. What proves the account is the client's own WGNI
 * web token, verified against Wargaming on the way in, so a row can only be
 * written by someone holding the game session it claims to describe.
 *
 * ## Why two halves
 *
 * The flat columns are the active setup, spread out so a question about the
 * population is an indexed read: which equipment the good players run on this
 * tank, how much gold they carry, which perks they train first. The `jsonb`
 * columns are the whole truth, secondary setups and per-shell counts included,
 * for the one page that draws a single player's tank. Neither can answer the
 * other's question at a price worth paying, so both are stored.
 *
 * The site's own `setup` token is deliberately NOT what is kept. It was built
 * to open a configurator and carries only the first shell of an ammunition
 * layout, which throws away the split between standard and premium rounds:
 * the most telling number in a loadout. The page rebuilds a token from these
 * columns when it needs one.
 *
 * ## Identifiers
 *
 * Equipment, consumables, directives, field modifications and crew skills are
 * stored by their **name** (`improvedVentilation`, `commander_eagleEye`),
 * which is global, stable across patches and what an aggregate groups by.
 * Modules and shells are stored by their **intCD**, because their names are
 * scoped to a nation and two nations can hold the same one; the name rides
 * along inside the JSON as a label.
 */
export function makeTankLoadoutsTable(region: string) {
  return pgTable(
    `${region}_tank_loadouts`,
    {
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      tankId: bigint("tank_id", { mode: "number" }).notNull(),

      // The active setup, flattened: the names actually fitted, with the
      // empty slots left out. Position is not kept here on purpose. It lives
      // in `setups`, which holds the layout whole, and these columns only ever
      // answer containment -- "who runs this equipment", "who trained this
      // perk" -- which a hole in the middle would only get in the way of.
      optDevices: text("opt_devices").array(),
      consumables: text("consumables").array(),
      /** Directives in the site's vocabulary, battle boosters in the client's. */
      boosters: text("boosters").array(),
      /** Every skill trained on this crew, deduplicated, for `@>` queries. */
      crewSkills: text("crew_skills").array(),
      /** Field modifications chosen, as `name:first` / `name:second`. */
      fieldMods: text("field_mods").array(),
      fieldModLevel: smallint("field_mod_level"),

      // What share of the rounds loaded cost gold, 0..1. Derived on the way in
      // rather than at read time: it is the figure every aggregate over this
      // table will want, and recomputing it per row per query would mean
      // unpacking the shell layout on every read.
      premiumShellShare: real("premium_shell_share"),
      /** Rounds loaded across the active setup, so a share can be re-weighted. */
      shellsLoaded: smallint("shells_loaded"),

      /** `{gun,turret,engine,chassis,radio}`, each `{id,name}`. */
      modules: jsonb("modules"),
      /** One entry per crew member: their role and their skills, in order. */
      crew: jsonb("crew"),
      /** Field modification level and pairs, or a tier XI skill tree. */
      progression: jsonb("progression"),
      /**
       * Both of the client's setup groups, each with its active index and its
       * layouts: `ammo` carries shells with counts plus consumables, `devices`
       * carries optional devices plus directives. The client caps a group at
       * two layouts and only unlocks the second through post progression.
       */
      setups: jsonb("setups"),

      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // One loadout per account per tank. A player changes their setup, they
      // do not accumulate them: the row is replaced, never appended to.
      primaryKey({ columns: [t.accountId, t.tankId] }),
      // The aggregate's access path: every question about the population is
      // asked of one tank at a time.
      index(`${region}_tank_loadouts_tank_idx`).on(t.tankId),
      // Containment over the flat arrays, which is what "who runs this
      // equipment" and "who trained this perk" both reduce to.
      index(`${region}_tank_loadouts_opt_devices_idx`).using(
        "gin",
        t.optDevices,
      ),
      index(`${region}_tank_loadouts_crew_skills_idx`).using(
        "gin",
        t.crewSkills,
      ),
    ],
  );
}

/**
 * Players who asked for their loadouts not to be shown.
 *
 * Global rather than per region, and one row for the account rather than one
 * flag per vehicle, because this is a decision about a person: somebody who
 * does not want their setups read does not want half of them read. The rows
 * stay either way, so the choice is reversible and the aggregates the site
 * builds keep their sample; what it governs is whether anyone can be told
 * which loadout is theirs.
 *
 * Keyed on the Wargaming account (`<region>-<account id>`, the key the
 * Wargaming sign-in stores and the streamers table already shares) rather than
 * on the unicum.gg user, so the read path can check it without resolving an
 * account back to a login it may not have. `userId` records who set it, which
 * is who signed in to do so.
 */
export const loadoutPrivacy = pgTable("loadout_privacy", {
  /** `<region>-<account id>`, as the Wargaming sign-in stores it. */
  wargamingAccount: text("wargaming_account").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  hidden: boolean("hidden").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TankLoadoutsTable = ReturnType<typeof makeTankLoadoutsTable>;

export const tankLoadoutsByRegion: Record<Region, TankLoadoutsTable> = {
  [Region.EU]: makeTankLoadoutsTable(Region.EU),
  [Region.NA]: makeTankLoadoutsTable(Region.NA),
  [Region.ASIA]: makeTankLoadoutsTable(Region.ASIA),
};
