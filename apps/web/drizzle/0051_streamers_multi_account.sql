-- Allow several WoT accounts to link the same Twitch channel (a streamer may
-- play across multiple accounts). Drop the UNIQUE index on twitch_login and
-- replace it with a plain index; the home rail collapses shared-channel rows to
-- one card, showing the most active account (see getLiveStreamers). Global
-- (non-factory) table, safe to let drizzle-kit see — but written by hand for
-- the same manual-apply workflow as the rest.
DROP INDEX IF EXISTS streamers_twitch_login_idx;
CREATE INDEX IF NOT EXISTS streamers_twitch_login_idx ON streamers (twitch_login);
