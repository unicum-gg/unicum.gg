import { NextResponse } from "next/server";
import {
  parseWebhookEvent,
  recordChargeRefund,
  recordInvoicePayment,
  stripeConfigured,
  syncSubscription,
} from "@unicum.gg/core/stripe";

// Verifies the Stripe signature over the raw body, so it must run per-request
// and read the unparsed body.
export const dynamic = "force-dynamic";

/**
 * Stripe webhook: keeps our `subscription` table in sync with the source of
 * truth. The subscription lifecycle events all carry the subscription object
 * (with our `userId` in metadata), so a single sync path covers create / update
 * / cancel. Returns 200 once handled; 400 on a bad signature.
 */
export async function POST(request: Request): Promise<Response> {
  if (!stripeConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const payload = await request.text();
  // Type flows from parseWebhookEvent's return (Stripe.Event); no `stripe` import
  // needed in the web app, which does not depend on the package directly.
  let event;
  try {
    event = parseWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "invoice.payment_succeeded":
      // Append to the support ledger so the cumulative funding bar reflects it.
      await recordInvoicePayment(event.data.object);
      break;
    case "charge.refunded":
      // Subtract the refund from the ledger so it stops counting as received.
      await recordChargeRefund(event.data.object);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
