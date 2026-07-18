import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { getSubscription, isActiveStatus } from "@unicum.gg/core/subscription";
import { stripeConfigured } from "@unicum.gg/core/stripe";

// Per-session support status; not cacheable.
export const dynamic = "force-dynamic";

/**
 * The logged-in user's support status, for the /support page: whether the
 * feature is configured, whether they are an active supporter, and their podium
 * anonymity preference. Never throws for logged-out users (returns not-supporter).
 */
export async function GET(): Promise<Response> {
  if (!stripeConfigured) {
    return NextResponse.json({ enabled: false, isSupporter: false, anonymous: false });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ enabled: true, isSupporter: false, anonymous: false });
  }
  const sub = await getSubscription(session.user.id);
  return NextResponse.json({
    enabled: true,
    isSupporter: sub ? isActiveStatus(sub.status) : false,
    anonymous: sub?.anonymous ?? false,
  });
}
