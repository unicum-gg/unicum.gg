ALTER TABLE "eu_players" RENAME COLUMN "wnx_recent" TO "wnx_30d";--> statement-breakpoint
ALTER TABLE "na_players" RENAME COLUMN "wnx_recent" TO "wnx_30d";--> statement-breakpoint
ALTER TABLE "asia_players" RENAME COLUMN "wnx_recent" TO "wnx_30d";--> statement-breakpoint
ALTER TABLE "eu_players" ADD COLUMN "battles_30d" integer;--> statement-breakpoint
ALTER TABLE "na_players" ADD COLUMN "battles_30d" integer;--> statement-breakpoint
ALTER TABLE "asia_players" ADD COLUMN "battles_30d" integer;
