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
 * tables, not per-region. `amountCents` drives the supporters podium (ranked by
 * current monthly amount; the amount itself is never shown publicly). `anonymous`
 * hides the supporter's name on the podium.
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
    anonymous: boolean("anonymous").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  // Podium query: filter active, order by amount desc.
  (table) => [
    index("subscription_status_amount_idx").on(table.status, table.amountCents),
  ],
);

/**
 * Ledger of every successful support payment (one row per successful Stripe
 * charge, keyed by the charge id so webhook retries are idempotent). Summed to
 * get the total amount received since launch, which the funding bar measures
 * against the cumulative infrastructure cost. Unlike `subscription` (current
 * monthly amount), this is append-only history.
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
