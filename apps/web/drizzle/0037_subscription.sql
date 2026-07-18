-- Support subscriptions (Stripe). One row per user: a pay-what-you-want monthly
-- pledge. Global identity table like the auth tables; hand-written rather than
-- drizzle-kit generated so the per-region factory tables are never touched
-- (drizzle-kit can't see them and would emit spurious DROPs).

CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);

ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "subscription_status_amount_idx" ON "subscription" ("status","amount_cents");
