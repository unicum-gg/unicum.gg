import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { account, env, subscription } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { isSupporter } from "@unicum.gg/core/subscription";
import { assignGuildRole, removeGuildRole } from "./index";

// The Discord identity is stored once, canonically, in Better Auth's `account`
// table (providerId "discord", set when the user links Discord). This module only
// reads that link and grants/revokes the supporter role via the bot — it never
// keeps a second copy of the Discord id.
const DISCORD_PROVIDER = "discord";
const ACTIVE_STATUSES = ["active", "trialing"] as const;

type SupporterRoleConfig = { guildId: string; roleId: string };

/** The supporter-role feature is available only when the bot, the guild and the
 * role id are all configured. */
export function supporterRoleConfig(): SupporterRoleConfig | null {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_SUPPORTER_ROLE_ID } = env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !DISCORD_SUPPORTER_ROLE_ID) {
    return null;
  }
  return { guildId: DISCORD_GUILD_ID, roleId: DISCORD_SUPPORTER_ROLE_ID };
}

export function isSupporterRoleEnabled(): boolean {
  return supporterRoleConfig() !== null;
}

/** The user's linked Discord account id, or null if they never linked Discord. */
export async function getDiscordUserId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ discordUserId: account.accountId })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, DISCORD_PROVIDER)),
    )
    .limit(1);
  return row?.discordUserId ?? null;
}

/** Grant the supporter role to a linked Discord user via the bot. Idempotent;
 * `false` if unconfigured or the bot can't assign it (Manage Roles / hierarchy). */
export async function grantSupporterRole(discordUserId: string): Promise<boolean> {
  const config = supporterRoleConfig();
  if (!config) return false;
  return assignGuildRole(config.guildId, discordUserId, config.roleId);
}

/** Whether a Discord account is still linked to some OTHER active supporter, so a
 * revoke on `exceptUserId` must not strip the shared role. */
async function otherActiveSupporterHasDiscord(
  discordUserId: string,
  exceptUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(account)
    .innerJoin(subscription, eq(subscription.userId, account.userId))
    .where(
      and(
        eq(account.providerId, DISCORD_PROVIDER),
        eq(account.accountId, discordUserId),
        ne(account.userId, exceptUserId),
        inArray(subscription.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Reconcile the supporter role for a user after their subscription changed
 * (called from the Stripe webhook). Grants when they are an active supporter,
 * revokes when they lapsed — but only if no other active supporter shares the same
 * Discord account. No-op when they never linked Discord. Never throws.
 */
export async function reconcileSupporterRole(userId: string): Promise<void> {
  const config = supporterRoleConfig();
  if (!config) return;
  try {
    const discordUserId = await getDiscordUserId(userId);
    if (!discordUserId) return; // never linked, nothing to reconcile
    if (await isSupporter(userId)) {
      await assignGuildRole(config.guildId, discordUserId, config.roleId);
      return;
    }
    if (await otherActiveSupporterHasDiscord(discordUserId, userId)) return;
    await removeGuildRole(config.guildId, discordUserId, config.roleId);
  } catch {
    // Best-effort: a Discord blip must never fail the webhook.
  }
}
