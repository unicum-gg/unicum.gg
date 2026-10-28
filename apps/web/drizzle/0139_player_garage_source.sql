-- Who said a vehicle is held, so two sources can both be believed.
--
-- Written by hand for the same reason 0128 was: drizzle-kit cannot see a table
-- built by a `makeXxxTable(region)` factory, and `db:generate` stops on an
-- interactive prompt rather than emit anything (see AGENTS.md).
--
-- 0128 built this table as "the garage as its owner's own token reported it".
-- That reading turns out to be half a garage. `wot/tanks/stats` only has a row
-- for a vehicle with a stats record, so a tank bought and never taken into a
-- battle does not exist for the API, token or not. Measured on one verified EU
-- account on 2026-10-27, with a fresh token:
--
--     held per WG and per the mod          124
--     held per the mod, absent from WG      80   <- invisible to this table
--     held per WG, no row in the mod         2
--
-- So the real garage was about 206 vehicles and the profile showed 126, and
-- the 80 it dropped are the collection pieces, which are the expensive ones.
-- Across every verified account, only 505 of 52,929 rows had no battle, which
-- is far too few for real garages: the never-driven half was simply absent.
--
-- The game client knows those vehicles, and nothing else does, so the mod now
-- states its inventory as a list. This column is what keeps the two readings
-- from deleting each other.
--
--     1  token   the account's own WG access token, through wot/tanks/stats
--     2  mod     the mod's sweep of the client's own inventory
--
-- **A union, not a ranking**, and the 2 vehicles above are why: neither source
-- contains the other, so letting either one replace the table would delete
-- real vehicles. Each source replaces only its own rows, and a read takes
-- every source's latest word. `verified_at` stays per row, so each source's
-- reading keeps its own age and a stale one can be told apart.

-- Every row that exists today came from a token read, which is what 0128 could
-- write. The default backfills them and is then dropped: a writer must name
-- its source, and a forgotten one should fail rather than quietly say "token".
ALTER TABLE eu_player_garage   ADD COLUMN IF NOT EXISTS source smallint NOT NULL DEFAULT 1;
ALTER TABLE na_player_garage   ADD COLUMN IF NOT EXISTS source smallint NOT NULL DEFAULT 1;
ALTER TABLE asia_player_garage ADD COLUMN IF NOT EXISTS source smallint NOT NULL DEFAULT 1;

ALTER TABLE eu_player_garage   ALTER COLUMN source DROP DEFAULT;
ALTER TABLE na_player_garage   ALTER COLUMN source DROP DEFAULT;
ALTER TABLE asia_player_garage ALTER COLUMN source DROP DEFAULT;

-- The source joins the key. Two sources holding one vehicle is two rows, which
-- is what makes each source's replace safe: it can only ever delete its own.
ALTER TABLE eu_player_garage   DROP CONSTRAINT IF EXISTS eu_player_garage_pkey;
ALTER TABLE na_player_garage   DROP CONSTRAINT IF EXISTS na_player_garage_pkey;
ALTER TABLE asia_player_garage DROP CONSTRAINT IF EXISTS asia_player_garage_pkey;

ALTER TABLE eu_player_garage   ADD CONSTRAINT eu_player_garage_pkey   PRIMARY KEY (account_id, tank_id, source);
ALTER TABLE na_player_garage   ADD CONSTRAINT na_player_garage_pkey   PRIMARY KEY (account_id, tank_id, source);
ALTER TABLE asia_player_garage ADD CONSTRAINT asia_player_garage_pkey PRIMARY KEY (account_id, tank_id, source);
