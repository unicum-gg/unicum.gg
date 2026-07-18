CREATE TABLE IF NOT EXISTS "support_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_payment" ADD CONSTRAINT "support_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
