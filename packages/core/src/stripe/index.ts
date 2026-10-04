import Stripe from "stripe";
import { clampSupportAmount, env, SupportMode } from "@unicum.gg/shared";
import {
  getSubscription,
  getSubscriptionByCustomer,
  getSupportProfile,
  getUserIdByStripeCustomer,
  recordPayment,
  recordRefund,
  setSupportCustomer,
  upsertSubscription,
  userExists,
} from "@unicum.gg/core/subscription";
import { reconcileSupporterRole } from "@unicum.gg/core/discord/supporter-role";

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

/**
 * A stored customer as it stands under the *active* Stripe key, or null when it
 * no longer resolves. A customer created in one mode (e.g. a local test run)
 * does not exist under a live key, and reusing its id makes Stripe reject the
 * call with `resource_missing`; the same happens if the customer was deleted.
 * Returns null in those cases so callers recreate instead of failing. Any other
 * error (network, auth) propagates.
 */
async function retrieveCustomer(
  s: Stripe,
  customerId: string,
): Promise<Stripe.Customer | null> {
  try {
    const customer = await s.customers.retrieve(customerId);
    return "deleted" in customer && customer.deleted ? null : (customer as Stripe.Customer);
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === "resource_missing"
    ) {
      return null;
    }
    throw err;
  }
}

/** Whether a stored customer id still resolves under the active Stripe key. */
async function customerExists(s: Stripe, customerId: string): Promise<boolean> {
  return !!(await retrieveCustomer(s, customerId));
}

/**
 * The Stripe customer for this user, created on first use and reused after.
 *
 * Reused rather than recreated so a repeat donor is one customer with one saved
 * card, and so a supporter who cancels and comes back keeps their history. The
 * stored id is checked first: an id from another Stripe mode (a local test run
 * against the shared DB) or a deleted customer does not resolve under the
 * active key and would make Checkout fail with `No such customer`.
 *
 * It lives on the support profile rather than on the subscription row, which is
 * what makes it reachable for a one-off donor: they never open a subscription,
 * so every donation used to mint a new customer.
 */
async function supportCustomerId(
  s: Stripe,
  userId: string,
  name: string,
): Promise<string> {
  const profile = await getSupportProfile(userId);
  const stored = profile?.stripeCustomerId ?? undefined;
  if (stored && (await customerExists(s, stored))) return stored;
  // No email set: WG accounts carry a synthetic `.local` email that can't
  // receive receipts, so Checkout collects a real one from the supporter.
  const customer = await s.customers.create({
    name,
    metadata: { userId },
  });
  await setSupportCustomer(userId, customer.id);
  return customer.id;
}

/**
 * Pay-what-you-want Checkout, in either shape: a monthly pledge the supporter
 * controls from the billing portal, or a single payment that commits them to
 * nothing. The amount is set inline via `price_data` in both cases (Stripe's
 * `custom_unit_amount` PWYW does not support recurring, and we collect the
 * amount ourselves anyway), so one product covers the two.
 *
 * Both run through a Stripe customer carrying our `userId`, which is what lets
 * the webhook attribute the charge: a one-off donation produces no subscription
 * to read it from, so the customer is the only thing both paths share.
 */
export async function createSupportCheckout(opts: {
  userId: string;
  name: string;
  amountCents: number;
  mode: SupportMode;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const s = requireStripe();
  if (!env.STRIPE_PRODUCT_ID) throw new Error("STRIPE_PRODUCT_ID missing");
  const amount = clampSupportAmount(opts.amountCents);
  const customer = await supportCustomerId(s, opts.userId, opts.name);
  const oneOff = opts.mode === SupportMode.OneOff;

  const session = await s.checkout.sessions.create({
    mode: oneOff ? "payment" : "subscription",
    customer,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          product: env.STRIPE_PRODUCT_ID,
          unit_amount: amount,
          ...(oneOff ? {} : { recurring: { interval: "month" as const } }),
        },
      },
    ],
    // Carried onto the subscription so the webhook can map it back to our user.
    // A one-off has no subscription, so the same id rides the payment intent,
    // which is what the Stripe dashboard shows beside the charge.
    ...(oneOff
      ? { payment_intent_data: { metadata: { userId: opts.userId } } }
      : { subscription_data: { metadata: { userId: opts.userId } } }),
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
  // A stored customer from another Stripe mode (or a deleted one) has nothing to
  // manage; treat it as no subscription rather than surfacing a Stripe error.
  if (!(await customerExists(s, existing.stripeCustomerId))) {
    throw new Error("No subscription for this user");
  }
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
 * The user a charge belongs to, or null when the customer is not one of ours.
 *
 * Resolved from the customer rather than from the subscription, and that is the
 * whole reason a one-off donation reaches the ledger at all: a single payment
 * creates no subscription to be resolved through. The same was already true of a
 * supporter's very first charge, since Checkout collects the money before it
 * creates the subscription, so Stripe emits `charge.succeeded` seconds ahead of
 * `customer.subscription.created`; resolving through the subscription alone
 * dropped every first payment, silently and for good.
 *
 * Three answers, cheapest first. Our own record of the customers we created
 * covers everything that went through a checkout. The subscription row covers a
 * customer created before that record existed. Stripe's own customer metadata is
 * the last resort, and the only one whose id did not come out of a table we own.
 */
async function chargeUserId(
  s: Stripe,
  customerId: string,
): Promise<string | null> {
  const owned = await getUserIdByStripeCustomer(customerId);
  if (owned) return owned;
  const sub = await getSubscriptionByCustomer(customerId);
  if (sub) return sub.userId;
  const customer = await retrieveCustomer(s, customerId);
  const userId = customer?.metadata?.userId;
  if (!userId) return null;
  // Unlike the two paths above, this id comes from Stripe rather than from a
  // row we own, so it is checked before it lands in the ledger's foreign key.
  return (await userExists(userId)) ? userId : null;
}

/**
 * Record a successful charge into the support ledger (called from the webhook),
 * keyed by the charge id so a refund on the same charge can be matched later.
 * The recent Stripe API dropped the invoice<->charge link from event payloads,
 * so the ledger is charge-based: the user is resolved from the charge's customer
 * (see `chargeUserId`). Ignores charges from customers that are not supporters.
 */
export async function recordChargePayment(charge: Stripe.Charge): Promise<void> {
  if (!charge.id || !charge.paid) return;
  const amountCents = charge.amount ?? 0;
  if (amountCents <= 0) return;
  const customerId = chargeCustomerId(charge);
  if (!customerId) return;
  const userId = await chargeUserId(requireStripe(), customerId);
  if (!userId) return; // not one of our support customers
  await recordPayment({
    chargeId: charge.id,
    userId,
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
  // Grant/revoke the Discord supporter role to match the new status (only acts if
  // the user ever claimed it). Best-effort, never throws.
  await reconcileSupporterRole(userId);
}
