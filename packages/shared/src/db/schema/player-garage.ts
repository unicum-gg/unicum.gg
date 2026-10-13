import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";
import { Region } from "@unicum.gg/wargaming";

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
      // When the token last confirmed this vehicle, not when the row was first
      // written: the writer restamps every vehicle it sees, so the newest stamp
      // on an account is the age of the whole reading.
      verifiedAt: timestamp("verified_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      primaryKey({ columns: [t.accountId, t.tankId] }),
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
