-- Reverse lookup on the rename history: given a nickname or tag nobody carries
-- anymore, find the account/clan that used to. Without these, resolving a
-- renamed player's old URL seq-scans the whole history table on every miss —
-- and a miss is exactly the common case, since any unknown nickname (typo,
-- bot, scraper) reaches this path before falling through to Wargaming.
--
-- Indexed on LOWER(...) to match the lookup, which is case-insensitive like the
-- `players`/`clans` ones it backs up.
CREATE INDEX IF NOT EXISTS eu_player_name_history_nickname_lower_idx
  ON eu_player_name_history (LOWER(nickname));
CREATE INDEX IF NOT EXISTS na_player_name_history_nickname_lower_idx
  ON na_player_name_history (LOWER(nickname));
CREATE INDEX IF NOT EXISTS asia_player_name_history_nickname_lower_idx
  ON asia_player_name_history (LOWER(nickname));

CREATE INDEX IF NOT EXISTS eu_clan_name_history_tag_lower_idx
  ON eu_clan_name_history (LOWER(tag));
CREATE INDEX IF NOT EXISTS na_clan_name_history_tag_lower_idx
  ON na_clan_name_history (LOWER(tag));
CREATE INDEX IF NOT EXISTS asia_clan_name_history_tag_lower_idx
  ON asia_clan_name_history (LOWER(tag));
