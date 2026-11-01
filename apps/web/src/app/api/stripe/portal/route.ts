import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { createSupportPortal, stripeConfigured } from "@unicum.gg/core/stripe";
import { env } from "@unicum.gg/shared";

// Reads the session + talks to Stripe, both per-request.
export const dynamic = "force-dynamic";

/**
 * Returns a Stripe billing-portal URL so the logged-in supporter can update or
 * cancel their pledge. 404 if the feature is off, 401 if not logged in, 400 if
 * they have no subscription to manage.
 *
 * The portal sends its visitor back to `/support` unless the body names a
 * `returnPath`, which the settings dialog does so a reader lands on the page
 * and the section they left. A same-origin path only (one leading slash, never
 * two), or anybody could make our portal link send its visitor elsewhere.
 */
export async function POST(request: Request): Promise<Response> {
  if (!stripeConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    returnPath?: unknown;
  } | null;
  const asked = body?.returnPath;
  const returnPath =
    typeof asked === "string" && /^\/(?![/\\])/.test(asked) ? asked : "/support";

  try {
    const url = await createSupportPortal({
      userId: session.user.id,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}${returnPath}`,
    });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "no_subscription" }, { status: 400 });
  }
}
