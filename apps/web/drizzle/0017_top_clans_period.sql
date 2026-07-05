-- Top clans: add period column (mirrors top_players), rebuild PK as
-- (metric, period, rank). Existing rows are the lifetime ranking, so they
-- backfill to 'overall'.
ALTER TABLE "eu_top_clans" ADD COLUMN "period" text NOT NULL DEFAULT 'overall';--> statement-breakpoint
ALTER TABLE "eu_top_clans" ALTER COLUMN "period" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "eu_top_clans" DROP CONSTRAINT "eu_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "eu_top_clans" ADD CONSTRAINT "eu_top_clans_pkey" PRIMARY KEY ("metric", "period", "rank");--> statement-breakpoint
ALTER TABLE "na_top_clans" ADD COLUMN "period" text NOT NULL DEFAULT 'overall';--> statement-breakpoint
ALTER TABLE "na_top_clans" ALTER COLUMN "period" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "na_top_clans" DROP CONSTRAINT "na_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "na_top_clans" ADD CONSTRAINT "na_top_clans_pkey" PRIMARY KEY ("metric", "period", "rank");--> statement-breakpoint
ALTER TABLE "asia_top_clans" ADD COLUMN "period" text NOT NULL DEFAULT 'overall';--> statement-breakpoint
ALTER TABLE "asia_top_clans" ALTER COLUMN "period" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "asia_top_clans" DROP CONSTRAINT "asia_top_clans_pkey";--> statement-breakpoint
ALTER TABLE "asia_top_clans" ADD CONSTRAINT "asia_top_clans_pkey" PRIMARY KEY ("metric", "period", "rank");
