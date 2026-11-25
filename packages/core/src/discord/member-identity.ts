import { and, desc, eq, ne } from "drizzle-orm";
import {
  account,
  env,
  user,
  wgIdentityFromAccountKey,
  type WgIdentity,
} from "@unicum.gg/shared";
import { Region, REGIONS } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { getPlayersByAccountIds } from "@unicum.gg/core/players/search-local";
import { assignGuildRole, botFetch, botRequestOk, removeGuildRole } from "./index";

/**
 * A linked member wears their Wargaming identity on our server: their nickname
 * as `Nickname [EU]`, and the role of the server their account actually lives
 * on.
 *
 * Nobody can rename themselves there (`@everyone` has no Change Nickname), so
 * the name beside a message in a stats community is the account it belongs to,
 * verified by the login rather than typed. The region role is the same fact:
 * the onboarding asks unlinked members which server they play on, and a link
 * replaces that answer with the one Wargaming gave.
 *
 * Applied when Discord is linked, undone when it is disconnected, and
 * reconciled every hour (`member-identity-cron`) for the two things neither
 * moment sees: a player renamed on Wargaming's side, and a player who linked
 * before joining the server. Everything here is best-effort: a Discord that
 * does not answer must never fail a link or a disconnect.
 *
 * The bot cannot rename the server owner, nor a member whose highest role sits
 * above its own, and Discord answers 403 for both. That is an expected answer,
 * not a failure worth reporting.
 */

const DISCORD_PROVIDER = "discord";
const WARGAMING_PROVIDER = "wargaming";
/** Discord's ceiling on a guild nickname. */
const NICKNAME_MAX = 32;

type Config = { guildId: string; regionRoles: Record<Region, string> };

function config(): Config | null {
  const {
    DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_EU_ROLE_ID,
    DISCORD_NA_ROLE_ID,
    DISCORD_ASIA_ROLE_ID,
  } = env;
  if (
    !DISCORD_BOT_TOKEN ||
    !DISCORD_GUILD_ID ||
    !DISCORD_EU_ROLE_ID ||
    !DISCORD_NA_ROLE_ID ||
    !DISCORD_ASIA_ROLE_ID
  ) {
    return null;
  }
  return {
    guildId: DISCORD_GUILD_ID,
    regionRoles: {
      [Region.EU]: DISCORD_EU_ROLE_ID,
      [Region.NA]: DISCORD_NA_ROLE_ID,
      [Region.ASIA]: DISCORD_ASIA_ROLE_ID,
    },
  };
}

export function isMemberIdentityEnabled(): boolean {
  return config() !== null;
}

/** "Straik [EU]". WG nicknames stop at 24 characters, so the longest one plus
 * " [ASIA]" is 31 and the cut below never happens in practice. */
export function memberNickname(nickname: string, region: Region): string {
  const tag = ` [${region.toUpperCase()}]`;
  return `${nickname.slice(0, NICKNAME_MAX - tag.length)}${tag}`;
}

type LinkedIdentity = WgIdentity & { nickname: string };

/**
 * The Wargaming account a Discord id answers to: the most recent link, since
 * one Discord account may be linked from several (a player with an EU and an NA
 * account), and the newest one is the one they last chose to show.
 */
async function linkedIdentity(
  discordUserId: string,
  exceptUserId?: string,
): Promise<LinkedIdentity | null> {
  const [link] = await db
    .select({ userId: account.userId, name: user.name })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(
      and(
        eq(account.providerId, DISCORD_PROVIDER),
        eq(account.accountId, discordUserId),
        exceptUserId ? ne(account.userId, exceptUserId) : undefined,
      ),
    )
    .orderBy(desc(account.createdAt))
    .limit(1);
  if (!link) return null;

  const [wg] = await db
    .select({ key: account.accountId })
    .from(account)
    .where(
      and(
        eq(account.userId, link.userId),
        eq(account.providerId, WARGAMING_PROVIDER),
      ),
    )
    .limit(1);
  const identity = wgIdentityFromAccountKey(wg?.key);
  if (!identity) return null;

  // Our players table first: the pipeline keeps it current, so a rename on
  // Wargaming's side reaches the server within the hour. The name stored at
  // login is the fallback, for an account the table does not hold.
  const [player] = await getPlayersByAccountIds(identity.region, [
    identity.accountId,
  ]).catch(() => []);
  const nickname = player?.nickname?.trim() || link.name?.trim();
  if (!nickname) return null;
  return { ...identity, nickname };
}

type Member = { nick: string | null; roles: string[] };

/**
 * Make one member wear the identity it should: the linked account's, or none
 * when nothing is linked any more. Touches only what differs, so the hourly
 * pass does not write an audit log entry per member per hour.
 */
async function apply(
  cfg: Config,
  discordUserId: string,
  identity: LinkedIdentity | null,
  { clearUnlinked }: { clearUnlinked: boolean },
): Promise<void> {
  // Null for a Discord account that is not on the server (yet): nothing to
  // rename, and the hourly pass comes back once they join.
  const member = await botFetch<Member>(
    `/guilds/${cfg.guildId}/members/${discordUserId}`,
  );
  if (!member) return;

  if (!identity) {
    // Only on a disconnect: the hourly pass never touches a member it has no
    // link for, or it would undo a name a moderator set by hand.
    if (!clearUnlinked) return;
    if (member.nick !== null) await setNickname(cfg, discordUserId, null);
    for (const roleId of Object.values(cfg.regionRoles)) {
      if (member.roles.includes(roleId)) {
        await removeGuildRole(cfg.guildId, discordUserId, roleId);
      }
    }
    return;
  }

  const nick = memberNickname(identity.nickname, identity.region);
  if (member.nick !== nick) await setNickname(cfg, discordUserId, nick);
  for (const region of REGIONS) {
    const roleId = cfg.regionRoles[region];
    const has = member.roles.includes(roleId);
    if (region === identity.region && !has) {
      await assignGuildRole(cfg.guildId, discordUserId, roleId);
    } else if (region !== identity.region && has) {
      await removeGuildRole(cfg.guildId, discordUserId, roleId);
    }
  }
}

function setNickname(
  cfg: Config,
  discordUserId: string,
  nick: string | null,
): Promise<boolean> {
  return botRequestOk(`/guilds/${cfg.guildId}/members/${discordUserId}`, {
    method: "PATCH",
    body: JSON.stringify({ nick }),
  });
}

/** Give a linked member their Wargaming name and server. Never throws. */
export async function syncMemberIdentity(discordUserId: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    const identity = await linkedIdentity(discordUserId);
    await apply(cfg, discordUserId, identity, { clearUnlinked: false });
  } catch (err) {
    console.warn("[discord] member identity sync failed:", err);
  }
}

/**
 * Undo it when `userId` disconnects Discord. Called while the link row still
 * exists, and reads past it: another account linked to the same Discord takes
 * over, and with none left the member gets their own name back and loses the
 * region role (they can pick one again in Channels & Roles). Never throws.
 */
export async function releaseMemberIdentity(
  userId: string,
  discordUserId: string,
): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    const identity = await linkedIdentity(discordUserId, userId);
    await apply(cfg, discordUserId, identity, { clearUnlinked: true });
  } catch (err) {
    console.warn("[discord] member identity release failed:", err);
  }
}

/** Every linked Discord account, once. The hourly pass and the backfill. */
export async function syncAllMemberIdentities(): Promise<number> {
  const cfg = config();
  if (!cfg) return 0;
  const rows = await db
    .selectDistinct({ discordUserId: account.accountId })
    .from(account)
    .where(eq(account.providerId, DISCORD_PROVIDER));
  for (const { discordUserId } of rows) {
    await syncMemberIdentity(discordUserId);
  }
  return rows.length;
}

/** Every Discord link, one row per (unicum.gg user, Discord account). */
export function listDiscordLinks(): Promise<
  { userId: string; discordUserId: string }[]
> {
  return db
    .select({ userId: account.userId, discordUserId: account.accountId })
    .from(account)
    .where(eq(account.providerId, DISCORD_PROVIDER));
}
