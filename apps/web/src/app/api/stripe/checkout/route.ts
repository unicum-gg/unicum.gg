import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { createSupportCheckout, stripeConfigured } from "@unicum.gg/core/stripe";
import { env } from "@unicum.gg/shared";

// Reads the session + talks to Stripe, both per-request.
export const dynamic = "force-dynamic";

/**
 * Starts a pay-what-you-want support subscription: creates a Stripe Checkout
 * session for the logged-in Wargaming user and returns its URL for the client to
 * redirect to. Requires a session; the pledge is keyed to the WG account.
 */
export async function POST(request: Request): Promise<Response> {
  if (!stripeConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let amountCents = 0;
  try {
    const body = (await request.json()) as { amountCents?: unknown };
    amountCents = Number(body.amountCents);
  } catch {
    amountCents = NaN;
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const base = env.NEXT_PUBLIC_APP_URL;
  const url = await createSupportCheckout({
    userId: session.user.id,
    name: session.user.name,
    amountCents,
    successUrl: `${base}/support?status=success`,
    cancelUrl: `${base}/support?status=canceled`,
  });

  return NextResponse.json({ url });
}
