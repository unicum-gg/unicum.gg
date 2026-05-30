CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"account_id" bigint NOT NULL,
	"nickname" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"battles" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"draws" integer NOT NULL,
	"survived_battles" integer NOT NULL,
	"frags" integer NOT NULL,
	"damage_dealt" bigint NOT NULL,
	"damage_received" bigint NOT NULL,
	"xp" bigint NOT NULL,
	"battle_avg_xp" integer NOT NULL,
	"spotted" integer NOT NULL,
	"capture_points" integer NOT NULL,
	"dropped_capture_points" integer NOT NULL,
	"hits" integer NOT NULL,
	"shots" integer NOT NULL,
	"hits_percents" real NOT NULL,
	"global_rating" integer NOT NULL,
	"wtr" integer,
	"clan_id" bigint
);
--> statement-breakpoint
CREATE TABLE "tank_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"tank_id" integer NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"battles" integer NOT NULL,
	"wins" integer NOT NULL,
	"damage_dealt" bigint NOT NULL,
	"spotted" integer NOT NULL,
	"frags" integer NOT NULL,
	"dropped_capture_points" integer NOT NULL,
	"radio_assisted_damage" bigint NOT NULL,
	"track_assisted_damage" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_snapshots" ADD CONSTRAINT "player_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tank_snapshots" ADD CONSTRAINT "tank_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_region_account_id_idx" ON "players" USING btree ("region","account_id");--> statement-breakpoint
CREATE INDEX "snapshots_player_id_taken_at_idx" ON "player_snapshots" USING btree ("player_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_player_id_battles_unique_idx" ON "player_snapshots" USING btree ("player_id","battles");--> statement-breakpoint
CREATE INDEX "snapshots_clan_id_idx" ON "player_snapshots" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "tank_snapshots_player_taken_idx" ON "tank_snapshots" USING btree ("player_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tank_snapshots_player_tank_battles_unique_idx" ON "tank_snapshots" USING btree ("player_id","tank_id","battles");