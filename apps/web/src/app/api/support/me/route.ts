import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import {
  getContributedCents,
  getSubscription,
  getSupportProfile,
  isActiveStatus,
} from "@unicum.gg/core/subscription";
import { stripeConfigured } from "@unicum.gg/core/stripe";
import {
  getCurrentClanOfUser,
  getSupportClanOfUser,
} from "@unicum.gg/core/subscription/clan";
import {
  getDiscordUserId,
  isSupporterRoleEnabled,
} from "@unicum.gg/core/discord/supporter-role";

// Per-session support status; not cacheable.
export const dynamic = "force-dynamic";

const EMPTY = {
  isSupporter: false,
  anonymous: false,
  contributedCents: 0,
  discordLinked: false,
  currentClan: null,
  supportClan: null,
};

/**
 * The logged-in user's support status, for the /support page: whether the
 * feature is configured, whether they hold an active pledge, what they have
 * given in total, their board anonymity preference, and the clan they count
 * their support for. Never throws for
 * logged-out users (returns not-supporter).
 *
 * The pledge and the total are two different answers and the page needs both:
 * someone who only ever gave once holds no pledge, yet they are on the
 * supporters board and must be able to take their name off it.
 */
export async function GET(): Promise<Response> {
  const discordRoleEnabled = isSupporterRoleEnabled();
  if (!stripeConfigured) {
    return NextResponse.json({ enabled: false, discordRoleEnabled, ...EMPTY });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ enabled: true, discordRoleEnabled, ...EMPTY });
  }
  const [sub, profile, contributedCents, currentClan, supportClan] =
    await Promise.all([
      getSubscription(session.user.id),
      getSupportProfile(session.user.id),
      getContributedCents(session.user.id),
      getCurrentClanOfUser(session.user.id),
      getSupportClanOfUser(session.user.id),
    ]);
  return NextResponse.json({
    enabled: true,
    isSupporter: sub ? isActiveStatus(sub.status) : false,
    anonymous: profile?.anonymous ?? false,
    contributedCents,
    // The clan the switch would count their support for, and the one it
    // counts for now (null once they have left it).
    currentClan,
    supportClan,
    discordRoleEnabled,
    discordLinked: discordRoleEnabled
      ? !!(await getDiscordUserId(session.user.id))
      : false,
  });
}
