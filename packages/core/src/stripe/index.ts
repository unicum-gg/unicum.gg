import Stripe from "stripe";
import { env } from "@unicum.gg/shared";
import {
  getSubscription,
  getSubscriptionByCustomer,
  recordPayment,
  recordRefund,
  upsertSubscription,
} from "@unicum.gg/core/subscription";

/**
 * Stripe client + support-subscription helpers. Web-only in practice (the secret
 * key lives on the web service); gated on `STRIPE_SECRET_KEY` so the app boots
 * and the feature degrades off when unconfigured.
 */
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

/** Whether the support-subscription feature is configured (keys + product set). */
export const stripeConfigured = !!(
  env.STRIPE_SECRET_KEY &&
  env.STRIPE_WEBHOOK_SECRET &&
  env.STRIPE_PRODUCT_ID
);

function requireStripe(): Stripe {
  if (!stripe) throw new Error("Stripe not configured (STRIPE_SECRET_KEY missing)");
  return stripe;
}

// Pay-what-you-want bounds (EUR cents): €3 floor, €1000 sanity cap.
export const SUPPORT_MIN_CENTS = 300;
export const SUPPORT_MAX_CENTS = 100_000;

export function clampSupportAmount(cents: number): number {
  return Math.min(Math.max(Math.round(cents), SUPPORT_MIN_CENTS), SUPPORT_MAX_CENTS);
}

/**
 * Pay-what-you-want recurring Checkout: the amount is set inline via `price_data`
 * (Stripe's `custom_unit_amount` PWYW does not support recurring), so the
 * supporter can pledge any monthly amount at or above the floor.
 */
export async function createSupportCheckout(opts: {
  userId: string;
  name: string;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const s = requireStripe();
  if (!env.STRIPE_PRODUCT_ID) throw new Error("STRIPE_PRODUCT_ID missing");
  const amount = clampSupportAmount(opts.amountCents);

  // Reuse the Stripe customer across (re)subscriptions to avoid duplicates.
  const existing = await getSubscription(opts.userId);
  let customerId = existing?.stripeCustomerId;
  if (!customerId) {
    // No email set: WG accounts carry a synthetic `.local` email that can't
    // receive receipts, so Checkout collects a real one from the supporter.
    const customer = await s.customers.create({
      name: opts.name,
      metadata: { userId: opts.userId },
    });
    customerId = customer.id;
  }

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          product: env.STRIPE_PRODUCT_ID,
          unit_amount: amount,
          recurring: { interval: "month" },
        },
      },
    ],
    // Carried onto the subscription so the webhook can map it back to our user.
    subscription_data: { metadata: { userId: opts.userId } },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe-hosted billing portal so supporters manage / cancel their pledge. */
export async function createSupportPortal(opts: {
  userId: string;
  returnUrl: string;
}): Promise<string> {
  const s = requireStripe();
  const existing = await getSubscription(opts.userId);
  if (!existing) throw new Error("No subscription for this user");
  const session = await s.billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: opts.returnUrl,
  });
  return session.url;
}

/** Verify + parse a webhook event from the raw request body. */
export function parseWebhookEvent(payload: string, signature: string): Stripe.Event {
  const s = requireStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  return s.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}

// Billing-period end moved onto items in recent Stripe API versions; read
// whichever the pinned version exposes.
function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items.data[0] as { current_period_end?: number } | undefined;
  const ts =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

function chargeCustomerId(charge: Stripe.Charge): string | undefined {
  return typeof charge.customer === "string"
    ? charge.customer
    : (charge.customer?.id ?? undefined);
}

/**
 * Record a successful charge into the support ledger (called from the webhook),
 * keyed by the charge id so a refund on the same charge can be matched later.
 * The recent Stripe API dropped the invoice<->charge link from event payloads,
 * so the ledger is charge-based: the user is resolved from the charge's customer
 * via their subscription. Ignores charges from customers with no support sub.
 */
export async function recordChargePayment(charge: Stripe.Charge): Promise<void> {
  if (!charge.id || !charge.paid) return;
  const amountCents = charge.amount ?? 0;
  if (amountCents <= 0) return;
  const customerId = chargeCustomerId(charge);
  if (!customerId) return;
  const sub = await getSubscriptionByCustomer(customerId);
  if (!sub) return; // not one of our support customers
  await recordPayment({
    chargeId: charge.id,
    userId: sub.userId,
    amountCents,
    currency: charge.currency,
  });
}

/**
 * Reflect a refund on the support ledger (called from the webhook): the charge
 * id is the ledger key, so we store the cumulative refunded amount directly. A
 * no-op if the charge is not one of ours.
 */
export async function recordChargeRefund(charge: Stripe.Charge): Promise<void> {
  if (!charge.id) return;
  await recordRefund(charge.id, charge.amount_refunded ?? 0);
}

/** Mirror a Stripe subscription into our DB (called from the webhook). */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return; // not one of ours / can't map
  const item = sub.items.data[0];
  await upsertSubscription({
    userId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    amountCents: item?.price?.unit_amount ?? 0,
    currency: item?.price?.currency ?? "eur",
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
}
