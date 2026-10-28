import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

/**
 * Who said this vehicle is held, because neither source can see it all.
 *
 * Not a preference order: a union. Each source replaces only its own rows, and
 * a read takes every source's latest word, because measurement says that
 * neither one contains the other. On one account on 2026-10-27: 80 vehicles
 * the mod held were absent from Wargaming's answer entirely, and 2 vehicles
 * Wargaming called held had no row in the mod's sweep. Letting either source
 * replace the table would therefore have deleted real vehicles.
 */
export const GARAGE_SOURCE = {
  /**
   * The account's own Wargaming access token, through `wot/tanks/stats`.
   *
   * Sees every vehicle with a stats record, which is every vehicle that was
   * ever taken into a battle, and it sees sales: `in_garage: false` is the
   * only proof a vehicle left. Blind to a vehicle bought and never driven,
   * for which Wargaming holds no row at all.
   */
  token: 1,
  /**
   * The mod's sweep of the client's own inventory.
   *
   * Sees the garage as the hangar draws it, never-driven vehicles included,
   * which is the half nothing else on this site can reach. Only ever for a
   * player who runs the mod, and only as fresh as their last garage visit.
   */
  mod: 2,
} as const;

export type GarageSource = (typeof GARAGE_SOURCE)[keyof typeof GARAGE_SOURCE];

/**
 * Which vehicles an account actually HOLDS, one row per owned vehicle.
 *
 * Everything else about a garage on this site is inferred from what the player
 * has driven, because that is all Wargaming publishes to a stranger:
 * `tanks/stats` answers with a row per vehicle the account has ever had, and
 * `in_garage` is `null` on every one of them. Measured on a 185-vehicle
 * account, 60 of those rows were vehicles sold long ago, so a third of what the
 * profile called a garage was not one.
 *
 * The flag fills in for one caller only: the account itself. A valid WG access
 * token turns `in_garage` into a real boolean, and we hold one for every player
 * who has signed in with Wargaming.net ID (encrypted, prolongated by
 * `auth/wargaming-token`). So this table is the garage as its owner's own token
 * reported it, and it exists because that reading is available exactly once per
 * linked account and must survive the request that obtained it: the player who
 * signs in is rarely the one looking at the page afterwards.
 *
 * It is keyed on the account rather than on the session, so a verified garage
 * is read by every visitor of that profile, not only by its owner. That is the
 * whole point: one sign-in makes the page right for everybody.
 *
 * **The token is not the only source any more, because it cannot be.** It
 * answers for every vehicle with a stats record, and a vehicle bought and
 * never taken into a battle has none: Wargaming holds no row for it at all,
 * token or not. On one account that was 80 vehicles out of about 206, and
 * they are the collection pieces, which are usually the expensive ones. The
 * game client knows them, so the mod states the inventory as a list and that
 * reading lands here under its own `source`. See `GARAGE_SOURCE` for why the
 * two are unioned rather than ranked.
 *
 * A vehicle sold after the last reading stays here until the next one, so
 * `verifiedAt` is published wherever the garage is, the way `measuredAt` is on
 * the marks. An account with no row here has never signed in, which reads as
 * "unverified" rather than as "empty garage".
 */
export function makePlayerGarageTable(region: string) {
  return pgTable(
    `${region}_player_garage`,
    {
      accountId: bigint("account_id", { mode: "number" }).notNull(),
      tankId: integer("tank_id").notNull(),
      /**
       * One of `GARAGE_SOURCE`.
       *
       * No default on purpose. The migration backfills the existing rows as
       * `token` and then drops the default, so a writer that forgets to name
       * its source fails instead of quietly claiming to be the token read.
       */
      source: smallint("source").notNull(),
      // When this source last confirmed this vehicle, not when the row was
      // first written: each writer restamps every vehicle it sees, so the
      // newest stamp of one source is the age of that source's whole reading.
      verifiedAt: timestamp("verified_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // The source is part of the key, so two sources hold the same vehicle
      // as two rows and neither can overwrite the other's reading.
      primaryKey({ columns: [t.accountId, t.tankId, t.source] }),
      // The profile's own read is by account, which the primary key already
      // serves. This one is for the reverse question (who holds this vehicle),
      // which the tank pages will ask once enough accounts are verified.
      index(`${region}_player_garage_tank_idx`).on(t.tankId),
    ],
  );
}

export type PlayerGarageTable = ReturnType<typeof makePlayerGarageTable>;
export type PlayerGarageRow = PlayerGarageTable["$inferSelect"];
export type NewPlayerGarage = PlayerGarageTable["$inferInsert"];

export const playerGarageByRegion: Record<Region, PlayerGarageTable> = {
  [Region.EU]: makePlayerGarageTable(Region.EU),
  [Region.NA]: makePlayerGarageTable(Region.NA),
  [Region.ASIA]: makePlayerGarageTable(Region.ASIA),
};
