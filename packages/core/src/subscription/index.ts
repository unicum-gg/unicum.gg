import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  subscription,
  supportPayment,
  supportProfile,
  user,
} from "@unicum.gg/shared";

export type Subscription = typeof subscription.$inferSelect;
export type SupportProfile = typeof supportProfile.$inferSelect;

// Stripe statuses that count as an active supporter (entitlement + badge).
const ACTIVE_STATUSES = ["active", "trialing"] as const;

/** Whether a Stripe subscription status counts as an active supporter. */
export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** The synthetic login email that bridges a WG account to its Better Auth user
 * (`<accountId>@<region>.wargaming.local`, see auth/wargaming `synthEmail`). */
function synthEmail(region: string, accountId: number): string {
  return `${accountId}@${region}.wargaming.local`;
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
 * The rows of `subscription` that earn a PUBLIC supporter badge: active, and
 * not opted out of the supporters board. Callers must have left-joined
 * `supportProfile`, which is where the opt-out lives; a user with no profile row
 * never opted out, hence the null branch.
 */
function publicSupporterFilter() {
  return and(
    inArray(subscription.status, [...ACTIVE_STATUSES]),
    or(isNull(supportProfile.anonymous), eq(supportProfile.anonymous, false)),
  );
}

/**
 * Whether a Wargaming account wears the public supporter badge: an active
 * subscription, not hidden behind podium anonymity. Resolved via the synthetic
 * login email, because Better Auth keys everything by its own opaque user id
 * while the player pages only know region + accountId.
 *
 * A one-off donation deliberately does not count: the badge says "is funding
 * the site", which only a live pledge keeps true.
 */
export async function isAccountPublicSupporter(
  region: string,
  accountId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(subscription)
    .innerJoin(user, eq(user.id, subscription.userId))
    .leftJoin(supportProfile, eq(supportProfile.userId, subscription.userId))
    .where(
      and(eq(user.email, synthEmail(region, accountId)), publicSupporterFilter()),
    )
    .limit(1);
  return !!row;
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

/** The user's support profile (Stripe customer + board anonymity), or null if
 * they have never opened a checkout nor set a preference. */
export async function getSupportProfile(
  userId: string,
): Promise<SupportProfile | null> {
  const [row] = await db
    .select()
    .from(supportProfile)
    .where(eq(supportProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

/** The user a Stripe customer belongs to, from our own record of the customers
 * we created. Answers for a one-off donor, who has no subscription row to be
 * resolved through. Null for a customer we did not create (or created before
 * this was stored), which the webhook then resolves from Stripe's own metadata. */
export async function getUserIdByStripeCustomer(
  stripeCustomerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ userId: supportProfile.userId })
    .from(supportProfile)
    .where(eq(supportProfile.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row?.userId ?? null;
}

/** Remember the Stripe customer we created for this user, so the next checkout
 * (monthly or one-off) reuses it instead of creating a duplicate. */
export async function setSupportCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .insert(supportProfile)
    .values({ userId, stripeCustomerId })
    .onConflictDoUpdate({
      target: supportProfile.userId,
      set: { stripeCustomerId },
    });
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

// Net of refunds, which is what "received" means everywhere this is summed.
const netReceived = sql<number>`coalesce(sum(${supportPayment.amountCents} - ${supportPayment.amountRefundedCents}), 0)`;

/** Net amount received from supporters since launch (cents of `currency`, EUR),
 * i.e. payments minus refunds, for the cumulative funding bar. Counts monthly
 * charges and one-off donations alike, since the ledger holds both. */
export async function getTotalReceivedCents(): Promise<number> {
  const [row] = await db.select({ total: netReceived }).from(supportPayment);
  return Number(row?.total ?? 0);
}

/** Net amount one user has given since launch (cents), which is what puts them
 * on the supporters board whether they pledged monthly or gave once. */
export async function getContributedCents(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: netReceived })
    .from(supportPayment)
    .where(eq(supportPayment.userId, userId));
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

/** Toggle whether the supporter is shown anonymously on the board. Open to
 * anyone who has contributed, including a one-off donor with no subscription,
 * which is why it writes to the profile rather than to a subscription row. */
export async function setAnonymous(userId: string, anonymous: boolean): Promise<void> {
  await db
    .insert(supportProfile)
    .values({ userId, anonymous })
    .onConflictDoUpdate({ target: supportProfile.userId, set: { anonymous } });
}

/** Total monthly pledge (in cents of `currency`, EUR) across active supporters,
 * for the funding bar's run-rate line. One-off donations are deliberately out:
 * this answers "what recurs every month", not "what came in". */
export async function getMonthlyPledgeCents(): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${subscription.amountCents}), 0)`,
    })
    .from(subscription)
    .where(inArray(subscription.status, [...ACTIVE_STATUSES]));
  return Number(row?.total ?? 0);
}

/** One board row. The amount is never exposed, only the ranking. */
export type PodiumEntry = { rank: number; name: string; anonymous: boolean };

/**
 * The supporters board: everyone who has given something, ranked by the net
 * total they have given since launch, highest first. Ties go to whoever gave
 * first. Anonymous supporters keep their rank and show as "Anonymous". Amounts
 * are intentionally not returned.
 *
 * Read from the ledger rather than from the subscriptions, which is what lets a
 * one-off donation be recognised at all: it ranks the money that actually
 * arrived, so a monthly pledge climbs as it is charged and a single donation
 * lands where its size puts it. The run-rate figure beside it still comes from
 * the live pledges (`getMonthlyPledgeCents`), since that is a different
 * question.
 *
 * A fully refunded contribution drops off rather than ranking last. The group-by
 * walks the whole ledger, which is a handful of rows per supporter per year and
 * needs no index of its own.
 */
export async function getSupportersPodium(limit = 50): Promise<PodiumEntry[]> {
  const rows = await db
    .select({ name: user.name, anonymous: supportProfile.anonymous })
    .from(supportPayment)
    .innerJoin(user, eq(user.id, supportPayment.userId))
    .leftJoin(supportProfile, eq(supportProfile.userId, supportPayment.userId))
    .groupBy(user.id, user.name, supportProfile.anonymous)
    .having(
      sql`sum(${supportPayment.amountCents} - ${supportPayment.amountRefundedCents}) > 0`,
    )
    .orderBy(
      desc(
        sql`sum(${supportPayment.amountCents} - ${supportPayment.amountRefundedCents})`,
      ),
      asc(sql`min(${supportPayment.createdAt})`),
    )
    .limit(limit);
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.anonymous ? "Anonymous" : r.name,
    anonymous: !!r.anonymous,
  }));
}
