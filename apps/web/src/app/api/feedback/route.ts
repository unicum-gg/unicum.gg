import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { APP_IDENTITY } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { feedbackBodySchema } from "@/components/feedback/schema";
import {
  isFeedbackEnabled,
  sendFeedbackToDiscord,
} from "@/services/discord/feedback";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import ROUTES from "@/constants/routes";

export const dynamic = "force-dynamic";

// A tiny in-memory sliding-window guard so one client can't flood the Discord
// channel. Best-effort (per-instance, resets on redeploy) — enough to stop
// accidental double-submits and casual abuse at this scale.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/**
 * Send feedback
 * @description Forward a message to the team's private Discord channel. Open to everyone, no key and no account: the sender's Wargaming identity is attached from the session when signed in, otherwise the feedback is anonymous. Rate limited per client. 404 when the feature is unconfigured, 400 on a bad body, 429 when rate limited, 502 when it could not be delivered.
 * @body FeedbackBody
 * @response FeedbackResponse
 * @tag System
 * @openapi
 */
export async function POST(request: Request): Promise<Response> {
  if (!isFeedbackEnabled()) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = feedbackBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { topic, sentiment, message, page, umamiSessionId, discordAuthor } =
    parsed.data;

  const session = await auth.api.getSession({ headers: hdrs });
  const wg = wgIdentityFromEmail(session?.user?.email);
  const nickname = session?.user?.name;
  // A signed-in WG identity wins; the bot's Discord handle is the fallback for
  // `/feedback` (no web session). Neither is trusted from the client body: the
  // WG one comes from the session, the Discord one is labelled as unverified.
  const author =
    wg && nickname
      ? {
          nickname,
          region: wg.region,
          profileUrl: `${APP_IDENTITY.URL}${ROUTES.PLAYER(wg.region, nickname)}`,
        }
      : discordAuthor
        ? { discord: discordAuthor }
        : {};

  const ok = await sendFeedbackToDiscord({
    topic,
    sentiment,
    message,
    page,
    umamiSessionId,
    author,
  });
  if (!ok) {
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
