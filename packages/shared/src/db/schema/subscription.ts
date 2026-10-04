import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Support subscriptions (Stripe). One row per user: their pay-what-you-want
 * monthly pledge (>= the floor, chosen at checkout). Global like the auth
 * tables, not per-region. `amountCents` is the current monthly run-rate the
 * funding bar measures the bill against; the supporters board itself ranks by
 * what was actually received (see `supportPayment`), so a monthly pledge and a
 * one-off donation are counted the same way.
 */
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    // Stripe subscription status: active, trialing, past_due, canceled, unpaid, ...
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("eur"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  // Run-rate query: filter active, sum the amounts.
  (table) => [
    index("subscription_status_amount_idx").on(table.status, table.amountCents),
  ],
);

/**
 * Who a supporter is to us, independently of whether they are currently
 * subscribed: their Stripe customer, and whether they want their name shown on
 * the supporters board.
 *
 * Both used to live on the `subscription` row, which only worked while every
 * contribution was a subscription. A one-off donor has no such row, so the
 * anonymity switch had nothing to write to (they would be named on a public
 * board with no way out) and every donation created a second Stripe customer
 * for the same person, since the stored id was reachable only through a
 * subscription they never opened.
 *
 * `stripeCustomerId` is what a checkout reuses. It is also mirrored onto the
 * subscription row by the webhook, which is Stripe's own view of which customer
 * holds the subscription and is what the billing portal and the charge-to-user
 * resolution read; this one is the user's customer, written once when we create
 * it.
 */
export const supportProfile = pgTable("support_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Null until the user opens their first checkout: a preference can be set
  // before any money has moved, and is kept after a subscription is gone.
  stripeCustomerId: text("stripe_customer_id"),
  // Hides the name on the supporters board, and with it the public supporter
  // badge on the player page.
  anonymous: boolean("anonymous").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Ledger of every successful support payment (one row per successful Stripe
 * charge, keyed by the charge id so webhook retries are idempotent). Summed to
 * get the total amount received since launch, which the funding bar measures
 * against the cumulative infrastructure cost, and grouped by user to rank the
 * supporters board. Unlike `subscription` (current monthly amount), this is
 * append-only history, and it is the one table that sees both kinds of
 * contribution: a monthly charge and a one-off donation arrive here alike,
 * which is why neither the bar nor the board has to know which was which.
 */
export const supportPayment = pgTable("support_payment", {
  // Stripe charge id, so a redelivered webhook cannot double-count, and a refund
  // on that charge finds the row it has to write down.
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  // Amount refunded on this payment (cents). Subtracted from `amountCents` when
  // summing what was actually received, so a refund stops counting as income.
  amountRefundedCents: integer("amount_refunded_cents").notNull().default(0),
  currency: text("currency").notNull().default("eur"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
