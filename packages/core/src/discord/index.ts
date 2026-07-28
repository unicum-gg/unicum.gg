import { APP_IDENTITY, env } from "@unicum.gg/shared";

// Minimal bot-token Discord REST client, usable from the web AND the worker (no
// discord.js dep — plain fetch). Lets our own bot post boost notifications into
// a channel the officer picked, and enumerate the servers/channels for that
// picker, so no per-channel webhooks are needed.
const API = "https://discord.com/api/v10";
const BRAND = 0xf25322;

/** Text-like channel types we can post into (text, announcement). */
const POSTABLE_CHANNEL_TYPES = new Set([0, 5]);

export function discordBotEnabled(): boolean {
  return Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_APP_ID);
}

async function botFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  if (!env.DISCORD_BOT_TOKEN) return null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

export type DiscordGuild = { id: string; name: string; icon: string | null };
export type DiscordChannel = { id: string; name: string; position: number };

/** The guilds our bot is a member of (so the officer can only pick from ones it
 * can actually post to). Bot guild lists are capped at 200 without pagination —
 * fine for our scale. */
export async function listBotGuilds(): Promise<DiscordGuild[]> {
  const guilds = await botFetch<DiscordGuild[]>("/users/@me/guilds?limit=200");
  return guilds ?? [];
}

/** The postable text channels of a guild, ordered as Discord shows them. */
export async function listGuildChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  const channels = await botFetch<
    { id: string; name: string; type: number; position: number }[]
  >(`/guilds/${guildId}/channels`);
  if (!channels) return [];
  return channels
    .filter((c) => POSTABLE_CHANNEL_TYPES.has(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, position: c.position }));
}

export type BoostNotification = {
  clanTag: string;
  clanUrl: string;
  workflowName: string;
  onlineCount: number;
  reserves: { name: string; level: number; percent: number | null }[];
};

/** Post a boost-activation embed to a channel as the bot. Best-effort: resolves
 * `true` on success, `false` if the bot can't post (removed, no permission…). */
export async function sendBoostNotification(
  channelId: string,
  n: BoostNotification,
): Promise<boolean> {
  const lines = n.reserves.map(
    (r) =>
      `• **${r.name}** L${r.level}${r.percent != null ? ` (+${r.percent}%)` : ""}`,
  );
  const res = await botFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          title: "⚡ Stronghold boosts activated",
          url: n.clanUrl,
          description: `**[${n.clanTag}]** · ${n.workflowName || "Boost workflow"}\n${lines.join("\n")}`,
          color: BRAND,
          footer: { text: `${n.onlineCount} online · ${APP_IDENTITY.NAME}` },
          timestamp: undefined,
        },
      ],
    }),
  });
  return res !== null;
}

/** Post a plain test message so the officer can confirm the channel works. */
export async function sendTestNotification(
  channelId: string,
  clanTag: string,
): Promise<boolean> {
  const res = await botFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          title: "✅ Boost notifications connected",
          description: `[${clanTag}] Stronghold boost activations will be posted here.`,
          color: BRAND,
          footer: { text: APP_IDENTITY.NAME },
        },
      ],
    }),
  });
  return res !== null;
}
