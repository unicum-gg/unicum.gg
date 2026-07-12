-- Curated seed: more known EU streamers (verified=false; ownership not proven).
INSERT INTO "streamers" ("id", "region", "account_id", "twitch_login", "verified") VALUES
	('eu-501091721', 'eu', 501091721, 'dezgamez', false),
	('eu-503233015', 'eu', 503233015, 'skill4ltu', false),
	('eu-501714035', 'eu', 501714035, 'orzanel', false),
	('eu-500057625', 'eu', 500057625, 'newmultishow', false),
	('eu-502099908', 'eu', 502099908, 'fc_dynamo', false),
	('eu-601464554', 'eu', 601464554, 'arkos_ua', false),
	('eu-550895430', 'eu', 550895430, 'thegigawatt', false),
	('eu-506994082', 'eu', 506994082, 'dani2999_', false),
	('eu-501039319', 'eu', 501039319, 'stahlsebbl', false),
	('eu-504108839', 'eu', 504108839, 'prof_mono', false),
	('eu-539340138', 'eu', 539340138, 'kecajek', false),
	('eu-630637523', 'eu', 630637523, 'kajzoo', false),
	('eu-533985353', 'eu', 533985353, 'fr3ddy', false)
ON CONFLICT ("id") DO NOTHING;
