import { and, eq, inArray } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { streamers, subscription, user } from "@unicum.gg/shared";

/**
 * The public, per-player badge crests carried in leaderboard/list payloads.
 * `verified` = the owner connected this WoT account on the site (Wargaming.net
 * ID sign-in); `supporter` = an active, non-anonymous support subscription;
 * `streamer` = a linked Twitch channel (a streamer, live or not). The real-time
 * "live" pill is deliberately not here: it changes by the second and
 * self-resolves client-side from the shared streamers stream.
 *
 * The streamer badge carries the Twitch login (so it can link to the channel);
 * a non-null `twitchLogin` means the account is a streamer.
 */
export type PlayerBadges = {
  verified: boolean;
  supporter: boolean;
  twitchLogin: string | null;
};

// Stripe statuses that count as an active supporter (mirrors subscription/index).
const ACTIVE_STATUSES = ["active", "trialing"] as const;

/** The synthetic login email that bridges a WG account to its Better Auth user
 * (`<accountId>@<region>.wargaming.local`, see auth/wargaming `synthEmail`). */
function synthEmail(region: string, accountId: number): string {
  return `${accountId}@${region}.wargaming.local`;
}

/**
 * Resolve the public badges for a batch of accounts in one region, in three
 * cheap indexed lookups against the auth + streamers tables. Each flag is
 * independent (a streamer needn't be a connected user); accounts with no badge
 * simply get no entry (callers treat a missing entry as all-false).
 */
export async function resolvePlayerBadges(
  region: string,
  accountIds: number[],
): Promise<Map<number, PlayerBadges>> {
  const result = new Map<number, PlayerBadges>();
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) return result;

  const ensure = (id: number): PlayerBadges => {
    let entry = result.get(id);
    if (!entry) {
      entry = { verified: false, supporter: false, twitchLogin: null };
      result.set(id, entry);
    }
    return entry;
  };

  const idByEmail = new Map<string, number>();
  for (const id of unique) idByEmail.set(synthEmail(region, id), id);
  const emails = [...idByEmail.keys()];

  const [verifiedRows, supporterRows, streamerRows] = await Promise.all([
    // Verified: a connected user exists (login is Wargaming-only, so any user
    // for the synthetic email means the account was connected here).
    db.select({ email: user.email }).from(user).where(inArray(user.email, emails)),
    // Supporter: active, non-anonymous subscription for a connected user.
    db
      .select({ email: user.email })
      .from(subscription)
      .innerJoin(user, eq(user.id, subscription.userId))
      .where(
        and(
          inArray(user.email, emails),
          inArray(subscription.status, [...ACTIVE_STATUSES]),
          eq(subscription.anonymous, false),
        ),
      ),
    // Streamer: a linked Twitch channel (curated seed or owner-confirmed).
    db
      .select({ accountId: streamers.accountId, twitchLogin: streamers.twitchLogin })
      .from(streamers)
      .where(
        and(eq(streamers.region, region), inArray(streamers.accountId, unique)),
      ),
  ]);

  for (const row of verifiedRows) {
    const id = idByEmail.get(row.email);
    if (id !== undefined) ensure(id).verified = true;
  }
  for (const row of supporterRows) {
    const id = idByEmail.get(row.email);
    if (id !== undefined) ensure(id).supporter = true;
  }
  for (const row of streamerRows) ensure(row.accountId).twitchLogin = row.twitchLogin;

  return result;
}

/** Whether a single WoT account has been connected on the site. */
export async function isAccountVerified(
  region: string,
  accountId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, synthEmail(region, accountId)))
    .limit(1);
  return !!row;
}

/** The Twitch login linked to a single WoT account, or null if not a streamer.
 * Used by the player detail payload to link the streamer crest to the channel. */
export async function getAccountTwitchLogin(
  region: string,
  accountId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ twitchLogin: streamers.twitchLogin })
    .from(streamers)
    .where(and(eq(streamers.region, region), eq(streamers.accountId, accountId)))
    .limit(1);
  return row?.twitchLogin ?? null;
}
