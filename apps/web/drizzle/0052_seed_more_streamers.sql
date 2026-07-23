-- Curated seed: kajzoo's main account (_kajzoo_) plus two more EU streamers.
-- kajzoo already had a row on an alt account (ToeNailCollector); both now
-- coexist since twitch_login is no longer unique (see 0051), and the rail shows
-- whichever is most active. verified=false (ownership not proven).
INSERT INTO "streamers" ("id", "region", "account_id", "twitch_login", "verified") VALUES
	('eu-530471932', 'eu', 530471932, 'kajzoo', false),
	('eu-510515874', 'eu', 510515874, 'kamileater', false),
	('eu-518913965', 'eu', 518913965, 'synop_s', false)
ON CONFLICT ("id") DO NOTHING;
