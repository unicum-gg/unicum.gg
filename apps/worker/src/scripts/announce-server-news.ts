// The one-off "what's new on the server" DM to the members already there when
// the onboarding, the change channels and the linked names shipped. Run once,
// by hand; it is not a channel for future news, and the message says so.
//
//   pnpm --filter @unicum.gg/worker announce-server-news            # dry run
//   pnpm --filter @unicum.gg/worker announce-server-news --send
//   pnpm --filter @unicum.gg/worker announce-server-news --send --to <user id>   # one test DM
//
// Only OUR server's members (`DISCORD_GUILD_ID`), never the bot's other
// servers. Skips bots and the owner. A linked member is recognised by the
// `Nickname [EU]` name the identity sync gave them and gets the linked shape.
import { env, memberAccountFromNickname, welcomeMessage, WelcomeKind } from "@unicum.gg/shared";
import { botFetch, sendDirectMessageBody } from "@unicum.gg/core/discord";

/** Between two DMs, so a few dozen in a row do not read as spam to Discord. */
const PACE_MS = 3_000;

type Member = {
  user: { id: string; username: string; global_name: string | null; bot?: boolean };
  nick: string | null;
};

async function main(): Promise<void> {
  const send = process.argv.includes("--send");
  const to = process.argv[process.argv.indexOf("--to") + 1];
  const only = process.argv.includes("--to") ? to : null;
  const guildId = env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID must be set");

  const guild = await botFetch<{ owner_id: string }>(`/guilds/${guildId}`);
  const members = await botFetch<Member[]>(`/guilds/${guildId}/members?limit=1000`);
  if (!guild || !members) throw new Error("could not read the server's members");

  // `--to` is the test: one member, the owner included, so the person running
  // it can read the message before everyone does.
  const targets = only
    ? members.filter((m) => m.user.id === only)
    : members.filter((m) => !m.user.bot && m.user.id !== guild.owner_id);
  let sent = 0;
  for (const m of targets) {
    const account = memberAccountFromNickname(m.nick);
    const name = m.user.global_name ?? m.user.username;
    const label = `${m.user.username}${account ? ` (linked: ${m.nick})` : ""}`;
    if (!send) {
      console.log(`would DM ${label}`);
      continue;
    }
    const ok = await sendDirectMessageBody(
      m.user.id,
      welcomeMessage(WelcomeKind.Existing, { name, account }, {
        guildId,
        tankChangesChannelId: env.DISCORD_TANK_CHANGES_CHANNEL_ID,
        mapChangesChannelId: env.DISCORD_MAP_CHANGES_CHANNEL_ID,
        changelogChannelId: env.DISCORD_CHANGELOG_CHANNEL_ID,
      }),
    );
    if (ok) sent += 1;
    console.log(`${ok ? "sent to" : "could not DM"} ${label}`);
    await new Promise((resolve) => setTimeout(resolve, PACE_MS));
  }
  console.log(
    send
      ? `announce-server-news: ${sent} of ${targets.length} member(s) told`
      : `announce-server-news: ${targets.length} member(s) would be told (dry run, pass --send)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("announce-server-news failed:", error);
    process.exit(1);
  });
