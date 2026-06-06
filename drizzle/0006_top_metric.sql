-- Top players: add metric column, rebuild PK as (metric, period, rank).
ALTER TABLE "eu_top_players" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "eu_top_players" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "eu_top_players" DROP CONSTRAINT "eu_top_players_pkey";--> statement-breakpoint
ALTER TABLE "eu_top_players" ADD CONSTRAINT "eu_top_players_pkey" PRIMARY KEY ("metric", "period", "rank");--> statement-breakpoint
ALTER TABLE "na_top_players" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "na_top_players" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "na_top_players" DROP CONSTRAINT "na_top_players_pkey";--> statement-breakpoint
ALTER TABLE "na_top_players" ADD CONSTRAINT "na_top_players_pkey" PRIMARY KEY ("metric", "period", "rank");--> statement-breakpoint
ALTER TABLE "asia_top_players" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "asia_top_players" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "asia_top_players" DROP CONSTRAINT "asia_top_players_pkey";--> statement-breakpoint
ALTER TABLE "asia_top_players" ADD CONSTRAINT "asia_top_players_pkey" PRIMARY KEY ("metric", "period", "rank");--> statement-breakpoint
-- Top clans: add metric column, rebuild PK as (metric, rank).
ALTER TABLE "eu_top_clans" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "eu_top_clans" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "eu_top_clans" DROP CONSTRAINT "eu_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "eu_top_clans" ADD CONSTRAINT "eu_top_clans_pkey" PRIMARY KEY ("metric", "rank");--> statement-breakpoint
ALTER TABLE "na_top_clans" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "na_top_clans" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "na_top_clans" DROP CONSTRAINT "na_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "na_top_clans" ADD CONSTRAINT "na_top_clans_pkey" PRIMARY KEY ("metric", "rank");--> statement-breakpoint
ALTER TABLE "asia_top_clans" ADD COLUMN "metric" text NOT NULL DEFAULT 'wnx';--> statement-breakpoint
ALTER TABLE "asia_top_clans" ALTER COLUMN "metric" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "asia_top_clans" DROP CONSTRAINT "asia_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "asia_top_clans" ADD CONSTRAINT "asia_top_clans_pkey" PRIMARY KEY ("metric", "rank");
