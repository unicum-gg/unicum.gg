import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  account,
  env,
  subscription,
  SupporterTier,
  supporterMonths,
  supporterTier,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { assignGuildRole, removeGuildRole } from "./index";

// The Discord identity is stored once, canonically, in Better Auth's `account`
// table (providerId "discord", set when the user links Discord). This module only
// reads that link and grants/revokes the supporter roles via the bot — it never
// keeps a second copy of the Discord id.
const DISCORD_PROVIDER = "discord";
const ACTIVE_STATUSES = ["active", "trialing"] as const;

type MetalTier = Exclude<SupporterTier, SupporterTier.Base>;
const METAL_TIERS: MetalTier[] = [
  SupporterTier.Bronze,
  SupporterTier.Silver,
  SupporterTier.Gold,
];

type SupporterRoleConfig = {
  guildId: string;
  /** Worn by every supporter, whatever their tier, so `@Supporter` still
   * reaches all of them. */
  roleId: string;
  /** The metal worn on top of it, one at a time. A tier whose role is not
   * configured is simply not worn, so the base role works on its own. */
  tierRoles: Partial<Record<MetalTier, string>>;
};

/** The supporter-role feature is available only when the bot, the guild and the
 * role id are all configured. */
export function supporterRoleConfig(): SupporterRoleConfig | null {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_SUPPORTER_ROLE_ID } = env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !DISCORD_SUPPORTER_ROLE_ID) {
    return null;
  }
  const tierRoles: Partial<Record<MetalTier, string>> = {};
  const ids: Record<MetalTier, string | undefined> = {
    [SupporterTier.Bronze]: env.DISCORD_SUPPORTER_BRONZE_ROLE_ID,
    [SupporterTier.Silver]: env.DISCORD_SUPPORTER_SILVER_ROLE_ID,
    [SupporterTier.Gold]: env.DISCORD_SUPPORTER_GOLD_ROLE_ID,
  };
  for (const tier of METAL_TIERS) {
    const id = ids[tier];
    if (id) tierRoles[tier] = id;
  }
  return {
    guildId: DISCORD_GUILD_ID,
    roleId: DISCORD_SUPPORTER_ROLE_ID,
    tierRoles,
  };
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

/**
 * The tier a Discord account is owed, or null when it is owed no role at all.
 *
 * Read off the Discord account rather than off one user, because two supporters
 * may have linked the same one: it wears the longest pledge among them, and one
 * of them leaving must not strip what the other is still owed. `exceptUserId`
 * leaves out a user whose link is being removed. The pledge's start is the one
 * the crest reads (`getPublicSupportersSince`), so the site and the server can
 * never wear two different metals.
 */
async function owedTier(
  discordUserId: string,
  exceptUserId?: string,
): Promise<SupporterTier | null> {
  const [row] = await db
    .select({
      since: sql<Date | null>`min(coalesce(${subscription.startedAt}, ${subscription.createdAt}))`,
    })
    .from(account)
    .innerJoin(subscription, eq(subscription.userId, account.userId))
    .where(
      and(
        eq(account.providerId, DISCORD_PROVIDER),
        eq(account.accountId, discordUserId),
        inArray(subscription.status, [...ACTIVE_STATUSES]),
        exceptUserId ? ne(account.userId, exceptUserId) : undefined,
      ),
    );
  if (!row?.since) return null;
  return supporterTier(supporterMonths(new Date(row.since), Date.now()));
}

/**
 * Make the member's roles match `tier`: the base role and that tier's metal,
 * the other metals removed, or every one of them removed for null. `true` when
 * every call landed; each one is idempotent, so a partial failure is repaired
 * by the next pass rather than undone.
 */
async function applyTier(
  config: SupporterRoleConfig,
  discordUserId: string,
  tier: SupporterTier | null,
): Promise<boolean> {
  const { guildId } = config;
  const calls: Promise<boolean>[] = [
    tier
      ? assignGuildRole(guildId, discordUserId, config.roleId)
      : removeGuildRole(guildId, discordUserId, config.roleId),
  ];
  for (const metal of METAL_TIERS) {
    const roleId = config.tierRoles[metal];
    if (!roleId) continue;
    calls.push(
      metal === tier
        ? assignGuildRole(guildId, discordUserId, roleId)
        : removeGuildRole(guildId, discordUserId, roleId),
    );
  }
  const results = await Promise.all(calls);
  return results.every(Boolean);
}

/** Grant a linked supporter the roles of their tier via the bot. `false` if
 * unconfigured, owed nothing, or the bot can't assign them (Manage Roles /
 * hierarchy). */
export async function grantSupporterRole(discordUserId: string): Promise<boolean> {
  const config = supporterRoleConfig();
  if (!config) return false;
  const tier = await owedTier(discordUserId);
  if (!tier) return false;
  return applyTier(config, discordUserId, tier);
}

/**
 * Give the supporter roles back when a user disconnects Discord.
 *
 * Takes the Discord id rather than reading it, because by the time this is
 * useful the link is about to be gone: `reconcileSupporterRole` below answers
 * "never linked, nothing to reconcile" for exactly this user, so the roles would
 * stay granted to an account we no longer know anything about, with nothing
 * left that would ever revoke them. The caller reads the id, calls this, then
 * deletes the row.
 *
 * Another supporter sharing the Discord account keeps it on THEIR tier rather
 * than losing everything. Best-effort, a Discord blip must not fail the
 * disconnect.
 */
export async function releaseSupporterRole(
  userId: string,
  discordUserId: string,
): Promise<void> {
  const config = supporterRoleConfig();
  if (!config) return;
  try {
    await applyTier(config, discordUserId, await owedTier(discordUserId, userId));
  } catch {
    // Best-effort: the link is being removed either way.
  }
}

/**
 * Reconcile the supporter roles for a user: after their subscription changed
 * (the Stripe webhook, which also fires on every monthly renewal, the moment
 * the month count moves) and on the daily pass. Grants the base role and the
 * metal of their tier, swaps the metal when the tier moved, revokes everything
 * when they lapsed. No-op when they never linked Discord. Never throws.
 */
export async function reconcileSupporterRole(userId: string): Promise<void> {
  const config = supporterRoleConfig();
  if (!config) return;
  try {
    const discordUserId = await getDiscordUserId(userId);
    if (!discordUserId) return; // never linked, nothing to reconcile
    await applyTier(config, discordUserId, await owedTier(discordUserId));
  } catch {
    // Best-effort: a Discord blip must never fail the webhook.
  }
}
