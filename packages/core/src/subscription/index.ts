import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { subscription, supportPayment, user } from "@unicum.gg/shared";

export type Subscription = typeof subscription.$inferSelect;

// Stripe statuses that count as an active supporter (entitlement + podium).
const ACTIVE_STATUSES = ["active", "trialing"] as const;

/** Whether a Stripe subscription status counts as an active supporter. */
export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** The user's subscription row, or null if they never subscribed. */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * The support subscription for a Wargaming account, resolved via the synthetic
 * login email (`<accountId>@<region>.wargaming.local`, see auth/wargaming
 * `synthEmail`). Better Auth keys `subscription.userId` by its own opaque user
 * id, not by region/account, so the player pages (which only know region +
 * accountId) must join through the email. Null if the account never subscribed.
 */
export async function getAccountSubscription(
  region: string,
  accountId: number,
): Promise<Subscription | null> {
  const email = `${accountId}@${region}.wargaming.local`;
  const [row] = await db
    .select()
    .from(subscription)
    .innerJoin(user, eq(user.id, subscription.userId))
    .where(eq(user.email, email))
    .limit(1);
  return row?.subscription ?? null;
}

/** Whether the user currently has an active (or trialing) support subscription. */
export async function isSupporter(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        inArray(subscription.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);
  return !!row;
}

export type UpsertSubscriptionInput = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  amountCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Insert or update the user's subscription (keyed by userId) from Stripe state. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  await db
    .insert(subscription)
    .values({ id: randomUUID(), ...input })
    .onConflictDoUpdate({
      target: subscription.userId,
      set: {
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      },
    });
}

/** The subscription row for a Stripe customer, or null. Used to attribute an
 * invoice payment to a user when the invoice itself carries no metadata. */
export async function getSubscriptionByCustomer(
  stripeCustomerId: string,
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row ?? null;
}

/**
 * Whether a user id still matches a row. Guards ids that reach us from Stripe
 * (a customer's `userId` metadata) before they are written into a foreign key:
 * an id whose user is gone would turn the webhook into a 500 that Stripe then
 * redelivers for days, where skipping the charge simply loses one ledger line.
 */
export async function userExists(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return !!row;
}

/** Record a successful support payment (idempotent on the Stripe charge id). */
export async function recordPayment(input: {
  chargeId: string;
  userId: string;
  amountCents: number;
  currency: string;
}): Promise<void> {
  await db
    .insert(supportPayment)
    .values({
      id: input.chargeId,
      userId: input.userId,
      amountCents: input.amountCents,
      currency: input.currency,
    })
    .onConflictDoNothing({ target: supportPayment.id });
}

/** Net amount received from supporters since launch (cents of `currency`, EUR),
 * i.e. payments minus refunds, for the cumulative funding bar. */
export async function getTotalReceivedCents(): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${supportPayment.amountCents} - ${supportPayment.amountRefundedCents}), 0)`,
    })
    .from(supportPayment);
  return Number(row?.total ?? 0);
}

/** Record the total refunded amount on a payment (cents). Stripe reports the
 * cumulative refund on the charge, so this sets rather than increments, which
 * naturally covers repeated partial refunds. No-op if the payment is unknown. */
export async function recordRefund(
  chargeId: string,
  refundedCents: number,
): Promise<void> {
  await db
    .update(supportPayment)
    .set({ amountRefundedCents: refundedCents })
    .where(eq(supportPayment.id, chargeId));
}

/** Toggle whether the supporter is shown anonymously on the podium. */
export async function setAnonymous(userId: string, anonymous: boolean): Promise<void> {
  await db
    .update(subscription)
    .set({ anonymous })
    .where(eq(subscription.userId, userId));
}

/** Total monthly pledge (in cents of `currency`, EUR) across active supporters,
 * for the funding progress bar. */
export async function getMonthlyPledgeCents(): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${subscription.amountCents}), 0)`,
    })
    .from(subscription)
    .where(inArray(subscription.status, [...ACTIVE_STATUSES]));
  return Number(row?.total ?? 0);
}

/** One podium row. The monthly amount is never exposed, only the ranking. */
export type PodiumEntry = { rank: number; name: string; anonymous: boolean };

/**
 * Supporters ranked by current monthly amount (highest first; ties broken by who
 * subscribed earliest). Anonymous supporters keep their rank but show as
 * "Anonymous". Amounts are intentionally not returned.
 */
export async function getSupportersPodium(limit = 50): Promise<PodiumEntry[]> {
  const rows = await db
    .select({ name: user.name, anonymous: subscription.anonymous })
    .from(subscription)
    .innerJoin(user, eq(user.id, subscription.userId))
    .where(inArray(subscription.status, [...ACTIVE_STATUSES]))
    .orderBy(desc(subscription.amountCents), asc(subscription.createdAt))
    .limit(limit);
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.anonymous ? "Anonymous" : r.name,
    anonymous: r.anonymous,
  }));
}
