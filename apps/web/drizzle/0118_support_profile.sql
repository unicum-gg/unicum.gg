-- Who a supporter is to us, separately from whether they are subscribed.
--
-- The supporters board now ranks by what each person has actually given rather
-- than by the monthly pledge they hold, so a one-off donation puts somebody on
-- a public board without ever creating a subscription row. Two things lived on
-- that row and had to move, because both are about the person and not about the
-- subscription:
--
-- The anonymity switch, which a one-off donor had nowhere to write. Left there,
-- the board would name them with no way out, and the switch would be offered
-- only to the people who happen to pay monthly.
--
-- The Stripe customer id, which a checkout reuses so the same donor is one
-- customer with one saved card rather than a new one per donation. Reachable
-- only through a subscription, it was unreachable for anybody who never opened
-- one. The subscription row keeps its own copy: that one is the webhook's
-- mirror of which customer Stripe says holds the subscription, read by the
-- billing portal and by the charge-to-user resolution.
--
-- Additive on purpose, and the drop of `subscription.anonymous` is its own
-- migration (0119): applied before the deploy lands, a drop would take the
-- running code's badge queries down with it.
--
-- Hand-written rather than generated: `drizzle-kit generate` cannot see the
-- per-region tables inside their factory functions and asks to drop them, so it
-- never reaches a change like this one.

CREATE TABLE IF NOT EXISTS "support_profile" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "stripe_customer_id" text,
  "anonymous" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Carry over what the subscription row already knew, so nobody's anonymity
-- silently flips back on and no existing supporter gets a second Stripe
-- customer on their next checkout.
INSERT INTO "support_profile" ("user_id", "stripe_customer_id", "anonymous")
SELECT "user_id", "stripe_customer_id", "anonymous"
FROM "subscription"
ON CONFLICT ("user_id") DO NOTHING;
