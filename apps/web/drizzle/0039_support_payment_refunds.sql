ALTER TABLE "support_payment" ADD COLUMN IF NOT EXISTS "amount_refunded_cents" integer DEFAULT 0 NOT NULL;
