import { GuildMemberFlags, type GuildMember } from "discord.js";
import {
  env,
  memberAccountFromNickname,
  welcomeMessage,
  WelcomeKind,
} from "@unicum.gg/shared";

/**
 * Welcome a newcomer to OUR server with a direct message.
 *
 * The bot sits in other people's servers too, and a stranger joining one of
 * those must hear nothing from us, so anything that is not `DISCORD_GUILD_ID`
 * is ignored, and so is everything when it is unset. Sent once: a member who
 * left and came back carries Discord's own DidRejoin flag, which no store of
 * ours could keep better. Bots get nothing.
 *
 * Who they are decides the shape. A player who arrived through the link on the
 * site is renamed `Nickname [EU]` by the web right after it adds them, and a
 * member cannot rename themselves, so after a short wait the nickname alone
 * says whether they are linked and as whom, with no call back to the API.
 *
 * Best-effort: closed DMs are an answer, not a failure, and nothing is posted
 * anywhere instead.
 */

/** Long enough for the web's rename to land after it adds a linked player. */
const SETTLE_MS = 15_000;

export async function welcomeNewMember(member: GuildMember): Promise<void> {
  const guildId = env.DISCORD_GUILD_ID;
  if (!guildId || member.guild.id !== guildId) return;
  if (member.user.bot) return;
  if (member.flags.has(GuildMemberFlags.DidRejoin)) return;

  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  const fresh = await member.fetch(true).catch(() => null);
  // Left again within the wait: nobody to welcome.
  if (!fresh) return;

  const account = memberAccountFromNickname(fresh.nickname);
  const message = welcomeMessage(
    account ? WelcomeKind.Linked : WelcomeKind.Newcomer,
    { name: fresh.user.displayName, account },
    {
      guildId,
      tankChangesChannelId: env.DISCORD_TANK_CHANGES_CHANNEL_ID,
      mapChangesChannelId: env.DISCORD_MAP_CHANGES_CHANNEL_ID,
      changelogChannelId: env.DISCORD_CHANGELOG_CHANNEL_ID,
    },
  );
  try {
    await fresh.send(message);
    console.log(`[bot] welcomed ${fresh.user.tag}`);
  } catch {
    console.log(`[bot] could not DM ${fresh.user.tag} (DMs closed)`);
  }
}
