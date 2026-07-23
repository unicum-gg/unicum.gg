-- Curated seed: Dakillzor + Quickfingers (QuickyBaby's WoT main). Both channels
-- already had a row on a different account (Animal / PlaysforFree); both coexist
-- now that twitch_login is not unique (see 0051), and the rail shows whichever
-- is most active. verified=false (ownership not proven).
INSERT INTO "streamers" ("id", "region", "account_id", "twitch_login", "verified") VALUES
	('eu-500135417', 'eu', 500135417, 'dakillzor', false),
	('eu-500127528', 'eu', 500127528, 'quickybaby', false)
ON CONFLICT ("id") DO NOTHING;
