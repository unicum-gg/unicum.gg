import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { createSupportCheckout, stripeConfigured } from "@unicum.gg/core/stripe";
import { isSupporter } from "@unicum.gg/core/subscription";
import { env, isSupportMode, SupportMode } from "@unicum.gg/shared";

// Reads the session + talks to Stripe, both per-request.
export const dynamic = "force-dynamic";

/**
 * Starts a pay-what-you-want support checkout and returns its URL for the
 * client to redirect to: `mode` picks a monthly pledge or a single payment, the
 * amount is free in both. Requires a session; the contribution is keyed to the
 * WG account.
 *
 * A second monthly pledge is refused rather than opened. Stripe would happily
 * create another subscription on the same customer, while our table holds one
 * row per user, so the webhook's upsert would overwrite the first and leave a
 * subscription nobody can see still charging them. Changing a pledge is the
 * billing portal's job; the one-off path stays open to an existing supporter,
 * since giving extra on top is exactly what it is for.
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
  let mode: SupportMode = SupportMode.Monthly;
  try {
    const body = (await request.json()) as {
      amountCents?: unknown;
      mode?: unknown;
    };
    amountCents = Number(body.amountCents);
    // Absent means monthly: that was the only shape this endpoint ever had.
    if (body.mode !== undefined) {
      if (!isSupportMode(body.mode)) {
        return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
      }
      mode = body.mode;
    }
  } catch {
    amountCents = NaN;
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  if (mode === SupportMode.Monthly && (await isSupporter(session.user.id))) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  const base = env.NEXT_PUBLIC_APP_URL;
  const url = await createSupportCheckout({
    userId: session.user.id,
    name: session.user.name,
    amountCents,
    mode,
    successUrl: `${base}/support?status=success&support=${mode}`,
    cancelUrl: `${base}/support?status=canceled`,
  });

  return NextResponse.json({ url });
}
