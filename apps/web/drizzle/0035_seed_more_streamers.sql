-- Curated seed: more known streamers (verified=false; ownership not proven).
INSERT INTO "streamers" ("id", "region", "account_id", "twitch_login", "verified") VALUES
	('eu-501644244', 'eu', 501644244, 'rysiek', false),
	('na-1007661316', 'na', 1007661316, 'o_p_hacker', false),
	('na-1023383904', 'na', 1023383904, 'german_intelligence', false)
ON CONFLICT ("id") DO NOTHING;
