-- Whose client recorded each battle's stored replay.
--
-- Written by hand, like every migration since the per-region factories:
-- `drizzle-kit generate` cannot read them. Purely additive: one nullable column
-- with no default on each regional table, which Postgres records in the
-- catalogue without rewriting a row, and which a partitioned parent passes on
-- to every partition.
--
-- The battle page names who recorded a battle, and the stored file is the
-- authority: it is the name a reader who downloads it sees. It cannot be
-- inferred from `reported_by`, whose first entry is whoever sent the RESULTS
-- and may never have sent a file. Filled when a file is stored, and for the
-- files already in the bucket by `pnpm --filter @unicum.gg/worker
-- backfill-replay-by`.

ALTER TABLE "eu_battles" ADD COLUMN IF NOT EXISTS "replay_by" bigint;
--> statement-breakpoint
ALTER TABLE "na_battles" ADD COLUMN IF NOT EXISTS "replay_by" bigint;
--> statement-breakpoint
ALTER TABLE "asia_battles" ADD COLUMN IF NOT EXISTS "replay_by" bigint;
