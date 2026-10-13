-- Which vehicles an account actually HOLDS, one row per owned vehicle.
--
-- Written by hand like the other per-region tables: drizzle-kit cannot see a
-- table built by a `makeXxxTable(region)` factory, and `db:generate` stops on
-- an interactive prompt rather than emit it (see AGENTS.md).
--
-- Everything the site says about a garage is inferred from what the player has
-- DRIVEN, because that is all Wargaming publishes to a stranger: `tanks/stats`
-- answers with a row per vehicle the account has ever had, and `in_garage` is
-- null on every one of them. Measured on a 185-vehicle account, 60 of those
-- rows were vehicles sold long ago, so a third of what the profile called a
-- garage was not one, and the account value built on top of it was paying for
-- tanks their owner no longer has.
--
-- The flag fills in for exactly one caller: the account itself. A valid WG
-- access token turns `in_garage` into a real boolean, and we hold one for every
-- player who has signed in with Wargaming.net ID. So this table is the garage
-- as its owner's own token reported it, and it exists because that reading is
-- available once per sign-in and has to outlive the request that obtained it.
--
-- Keyed on the WG account rather than on the site user, which is the whole
-- point: one sign-in makes that profile right for every visitor, not just for
-- its owner.
--
-- `verified_at` is restamped on every vehicle at each reading, so the newest
-- stamp on an account is the age of the whole garage rather than of its most
-- recent purchase. A vehicle sold since then stays until the next reading, so
-- the stamp is published wherever the garage is, as `measured_at` is on the
-- marks. No row for an account means nobody has ever signed in with it, which
-- reads as "unverified" and never as "empty garage".

CREATE TABLE IF NOT EXISTS eu_player_garage (
  account_id  bigint      NOT NULL,
  tank_id     integer     NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eu_player_garage_pkey PRIMARY KEY (account_id, tank_id)
);

CREATE TABLE IF NOT EXISTS na_player_garage (
  account_id  bigint      NOT NULL,
  tank_id     integer     NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT na_player_garage_pkey PRIMARY KEY (account_id, tank_id)
);

CREATE TABLE IF NOT EXISTS asia_player_garage (
  account_id  bigint      NOT NULL,
  tank_id     integer     NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asia_player_garage_pkey PRIMARY KEY (account_id, tank_id)
);

-- The profile reads by account, which the primary key already serves. This one
-- is the reverse question (which accounts hold this vehicle), which the tank
-- pages ask once enough accounts are verified.
CREATE INDEX IF NOT EXISTS eu_player_garage_tank_idx   ON eu_player_garage   (tank_id);
CREATE INDEX IF NOT EXISTS na_player_garage_tank_idx   ON na_player_garage   (tank_id);
CREATE INDEX IF NOT EXISTS asia_player_garage_tank_idx ON asia_player_garage (tank_id);
